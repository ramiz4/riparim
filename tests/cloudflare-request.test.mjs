import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const { build } = createRequire(new URL('../package.json', import.meta.url))('esbuild');
const authModule = new URL('../app/chatgpt-auth.ts', import.meta.url).pathname;
const fixtureHandler = `
import { getChatGPTUser } from ${JSON.stringify(authModule)};
export default {
  async fetch(request, env, ctx) {
    globalThis.fixtureForwardedRequest = request;
    globalThis.fixtureForwardedEnv = env;
    globalThis.fixtureForwardedContext = ctx;
    globalThis.fixtureRequestHeaders = request.headers;
    return Response.json({
      nativeUser: await getChatGPTUser(),
      headers: Object.fromEntries(request.headers),
      method: request.method,
      url: request.url,
      redirect: request.redirect,
      body: await request.text(),
    });
  },
};`;
const bundle = await build({
  entryPoints: ['build/cloudflare-worker.ts', 'build/sites-worker.ts', 'lib/cloudflare-request.ts'],
  outbase: '.',
  outdir: '.test-runtime/cloudflare-request',
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  define: { 'import.meta.env.DEV': 'false' },
  plugins: [{ name: 'request-auth-boundaries', setup(builder) {
    builder.onResolve({ filter: /^(vinext\/server\/fetch-handler|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
      loader: 'js',
      resolveDir: process.cwd(),
      contents: args.path === 'vinext/server/fetch-handler' ? fixtureHandler : args.path === 'next/headers'
        ? 'export async function headers() { return globalThis.fixtureRequestHeaders; }'
        : 'export function redirect() { throw new Error("Unexpected auth redirect"); }',
    }));
  } }],
});
for (const file of bundle.outputFiles) {
  const filename = file.path.replace(/\.js$/, '.mjs');
  await mkdir(new URL('.', pathToFileURL(filename)), { recursive: true });
  await writeFile(filename, file.contents);
}
const importFixture = name => import(new URL(`../.test-runtime/cloudflare-request/${name}.mjs`, import.meta.url));
const { default: cloudflareWorker } = await importFixture('build/cloudflare-worker');
const { default: sitesWorker } = await importFixture('build/sites-worker');
const { stripSitesIdentityHeaders } = await importFixture('lib/cloudflare-request');

const forgedHeaders = {
  'OAI-Authenticated-User-ID': 'forged-owner-id',
  'oai-authenticated-user-email': 'owner@example.test',
  'oai-authenticated-user-full-name': 'Forged%20Owner',
  'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
  'oai-authenticated-user-future-role': 'moderator',
  'oai-authenticated-user-': 'remove-entire-namespace',
};
const sessionHeaders = {
  Cookie: 'sb-fixture-auth-token=fixture-session; other=preserved',
  Authorization: 'Bearer fixture-access-token',
  Origin: 'https://riparim.com',
  'Content-Type': 'application/json',
  'X-Request-ID': 'fixture-request',
};
const url = 'https://riparim.com/api/visits?moderation=1';
const raw = new Request(url, { headers: { ...forgedHeaders, ...sessionHeaders } });
const sanitized = stripSitesIdentityHeaders(raw);
assert.equal(raw.headers.get('oai-authenticated-user-id'), 'forged-owner-id', 'sanitizing must not mutate the original Sites request');
assert.equal([...sanitized.headers.keys()].some(name => name.startsWith('oai-authenticated-user-')), false, 'all known and future Sites identity headers must be stripped');
for (const [name, value] of Object.entries(sessionHeaders)) assert.equal(sanitized.headers.get(name), value);

const controller = new AbortController();
const body = '{"review":"fixture upload body"}';
const request = new Request(url, {
  method: 'POST',
  headers: { ...forgedHeaders, ...sessionHeaders },
  body: new ReadableStream({ start(stream) { stream.enqueue(new TextEncoder().encode(body)); stream.close(); } }),
  duplex: 'half',
  redirect: 'manual',
  signal: controller.signal,
});
const env = { REVIEW_MODERATOR_EMAIL: 'owner@example.test' };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const owned = await (await cloudflareWorker.fetch(request, env, ctx)).json();
assert.equal(owned.nativeUser, null, 'forged owner headers must not authenticate on an owned Cloudflare Worker');
assert.equal(Object.keys(owned.headers).some(name => name.startsWith('oai-authenticated-user-')), false);
for (const [name, value] of Object.entries(sessionHeaders)) assert.equal(owned.headers[name.toLowerCase()], value, 'Supabase session and ordinary request headers must be preserved');
assert.equal(owned.method, 'POST');
assert.equal(owned.url, url);
assert.equal(owned.redirect, 'manual');
assert.equal(owned.body, body, 'the upload body must reach the application unchanged');
assert.equal(globalThis.fixtureForwardedEnv, env);
assert.equal(globalThis.fixtureForwardedContext, ctx);
controller.abort();
assert.equal(globalThis.fixtureForwardedRequest.signal.aborted, true, 'request cancellation must reach the application');

const native = await (await sitesWorker.fetch(new Request(url, { headers: forgedHeaders }), env, ctx)).json();
assert.equal(native.nativeUser.userId, 'forged-owner-id', 'the existing native Sites worker must still accept edge-supplied identity');
assert.equal(native.nativeUser.email, 'owner@example.test');
assert.equal(native.nativeUser.displayName, 'Forged Owner');

const sessionOnly = await (await cloudflareWorker.fetch(new Request(url, { headers: sessionHeaders }), env, ctx)).json();
assert.equal(sessionOnly.nativeUser, null);
assert.equal(sessionOnly.headers.cookie, sessionHeaders.Cookie);
console.log('Cloudflare request boundary: forged Sites identity stripped; native Sites identity, session headers and request body preserved');
