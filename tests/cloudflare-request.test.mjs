import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const { build } = createRequire(new URL('../package.json', import.meta.url))('esbuild');
const { Miniflare } = createRequire(new URL('../package.json', import.meta.url))('miniflare');
const releaseCommit = 'c'.repeat(40);
const authModule = new URL('../app/chatgpt-auth.ts', import.meta.url).pathname;
const fixtureHandler = `
import { getChatGPTUser } from ${JSON.stringify(authModule)};
export default {
  async fetch(request, env, ctx) {
    globalThis.fixtureForwardedRequest = request;
    globalThis.fixtureForwardedEnv = env;
    globalThis.fixtureForwardedContext = ctx;
    globalThis.fixtureRequestHeaders = request.headers;
    const mode = new URL(request.url).searchParams.get('fixture-response');
    if (mode === 'redirect') return Response.redirect('https://riparim.com/einstellungen?weiter=%2Fbetrieb', 303);
    if (mode) {
      const headers = new Headers({
        'Content-Type': mode === 'json' ? 'application/json' : 'text/html',
        'Cache-Control': 'private, no-store',
        'X-Riparim-Release-Commit': request.headers.get('X-Riparim-Release-Commit') || 'forged-response-marker',
      });
      headers.append('Set-Cookie', 'sb-fixture-auth-token=refreshed; Path=/; HttpOnly; Secure; SameSite=Lax');
      headers.append('Set-Cookie', 'riparim-google-flow=; Path=/auth/bestaetigen; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure');
      if (mode === 'stream') {
        globalThis.fixtureResponseStream = new ReadableStream({ start(controller) { globalThis.fixtureResponseController = controller; } });
        return new Response(globalThis.fixtureResponseStream, { status: 202, statusText: 'Fixture Accepted', headers });
      }
      return new Response(mode === 'json' ? JSON.stringify({ fixture: true }) : '<!doctype html><title>Fixture</title>', { status: mode === 'unavailable' ? 503 : 200, headers });
    }
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
const bundleOptions = {
  entryPoints: ['build/cloudflare-worker.ts', 'build/sites-worker.ts', 'lib/cloudflare-request.ts', 'proxy.ts'],
  outbase: '.',
  outdir: '.test-runtime/cloudflare-request',
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  define: { 'import.meta.env.DEV': 'false', __RIPARIM_RELEASE_COMMIT__: JSON.stringify(releaseCommit) },
  plugins: [{ name: 'request-auth-boundaries', setup(builder) {
    builder.onResolve({filter:/(?:notifications\/outbox|^\.\/outbox)$/},args=>({path:args.path,namespace:'notification-fixture'}));
    builder.onLoad({filter:/.*/,namespace:'notification-fixture'},()=>({loader:'js',contents:'export async function processNotifications(){return []; }'}));
    builder.onResolve({filter:/^(next\/server|@\/lib\/auth\/config|@supabase\/ssr)$/},args=>({path:args.path,namespace:'proxy-fixture'}));
    builder.onLoad({filter:/.*/,namespace:'proxy-fixture'},args=>({loader:'js',contents:args.path==='next/server'
      ? 'export const NextResponse={redirect:(url,status)=>new Response(null,{status,headers:{Location:String(url)}}),next:()=>{const response=new Response(null);response.cookies={set:(name,value)=>response.headers.append("Set-Cookie",name+"="+value+"; Path=/; HttpOnly; Secure; SameSite=Lax")};return response;}};'
      : args.path==='@/lib/auth/config' ? 'export async function getAuthConfig(){return globalThis.fixtureProxyAuthConfig??null;}'
      : 'export function createServerClient(project,key,options){if(!globalThis.fixtureProxyAuthConfig)throw new Error("Canonical routing must not access the provider");return {auth:{async getUser(){options.cookies.setAll([{name:"sb-fixture-auth-token",value:"refreshed",options:{}}]);}}};}'}));
    builder.onResolve({ filter: /^(vinext\/server\/fetch-handler|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
      loader: 'js',
      resolveDir: process.cwd(),
      contents: args.path === 'vinext/server/fetch-handler' ? fixtureHandler : args.path === 'next/headers'
        ? 'export async function headers() { return globalThis.fixtureRequestHeaders; }'
        : 'export function redirect() { throw new Error("Unexpected auth redirect"); }',
    }));
  } }],
};
const bundle = await build(bundleOptions);
for (const file of bundle.outputFiles) {
  const filename = file.path.replace(/\.js$/, '.mjs');
  await mkdir(new URL('.', pathToFileURL(filename)), { recursive: true });
  await writeFile(filename, file.contents);
}
const importFixture = name => import(new URL(`../.test-runtime/cloudflare-request/${name}.mjs`, import.meta.url));
const { default: cloudflareWorker } = await importFixture('build/cloudflare-worker');
const { default: sitesWorker } = await importFixture('build/sites-worker');
const { stripSitesIdentityHeaders } = await importFixture('lib/cloudflare-request');
const { proxy } = await importFixture('proxy');

for (const url of ['https://www.riparim.com/', 'http://www.riparim.com/werkstatt/fixture?suche=%2Fwerkstaetten&weiter=%2Feinstellungen']) {
  const response = await proxy(new Request(url));
  const expected = new URL(url);expected.hostname='riparim.com';expected.protocol='https:';
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), expected.href, 'www redirects preserve the path and complete query on the canonical HTTPS host');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
}
assert.equal((await proxy(new Request('https://riparim.com/einstellungen?weiter=%2Fbetrieb'))).status, 200, 'the canonical host must not loop');
assert.equal((await proxy(new Request('https://riparim.riparim-ec181b.workers.dev/'))).status, 200, 'the technical transfer host keeps its existing routing');

for (const enabled of [false, true]) {
  globalThis.fixtureProxyAuthConfig = enabled ? { enabled: true, projectUrl: 'https://fixture.supabase.co', publicKey: 'fixture-public-key' } : null;
  for (const [path, policy] of [['/auth/bestaetigen', 'no-referrer'], ['/auth/bestaetigen/', 'no-referrer'], ['/einstellungen', 'strict-origin-when-cross-origin']]) {
    const updatedCookies = [];
    const request = { url: `https://riparim.com${path}?token_hash=fixture-secret`, cookies: { getAll: () => [], set: (name, value) => updatedCookies.push([name, value]) } };
    const response = await proxy(request);
    assert.equal(response.headers.get('Referrer-Policy'), policy, 'callback token URLs must remain private, including after session-cookie refresh');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    if (enabled) {
      assert.equal(updatedCookies.length, 1);
      assert.match(response.headers.get('Set-Cookie'), /sb-fixture-auth-token=refreshed/);
    }
  }
}
globalThis.fixtureProxyAuthConfig = null;

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
const ownedResponse = await cloudflareWorker.fetch(request, env, ctx);
assert.equal(ownedResponse.headers.get('X-Riparim-Release-Commit'), releaseCommit);
const owned = await ownedResponse.json();
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

for (const mode of ['html', 'json', 'redirect', 'unavailable']) {
  const result = await cloudflareWorker.fetch(new Request(`${url}&fixture-response=${mode}`, { headers: { 'X-Riparim-Release-Commit': 'f'.repeat(40) } }), env, ctx);
  assert.equal(result.headers.get('X-Riparim-Release-Commit'), releaseCommit, 'response identity must come from baked release bytes, never a client marker');
  assert.equal(result.status, mode === 'redirect' ? 303 : mode === 'unavailable' ? 503 : 200);
  if (mode === 'redirect') {
    assert.equal(result.headers.get('Location'), 'https://riparim.com/einstellungen?weiter=%2Fbetrieb');
    assert.equal(result.body, null);
  } else {
    assert.deepEqual(result.headers.getSetCookie(), [
      'sb-fixture-auth-token=refreshed; Path=/; HttpOnly; Secure; SameSite=Lax',
      'riparim-google-flow=; Path=/auth/bestaetigen; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure',
    ], 'both session cookies must survive provenance stamping independently');
    assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(result.headers.get('Content-Type'), mode === 'json' ? 'application/json' : 'text/html');
    if (mode === 'json') assert.deepEqual(await result.json(), { fixture: true });
    else assert.equal(await result.text(), '<!doctype html><title>Fixture</title>');
  }
}
const streamed = await cloudflareWorker.fetch(new Request(`${url}&fixture-response=stream`), env, ctx);
assert.equal(streamed.status, 202);
assert.equal(streamed.statusText, 'Fixture Accepted');
assert.equal(streamed.headers.get('X-Riparim-Release-Commit'), releaseCommit);
assert.equal(streamed.body, globalThis.fixtureResponseStream, 'provenance must forward the original stream without buffering or teeing');
globalThis.fixtureResponseController.enqueue(new TextEncoder().encode('first chunk'));
globalThis.fixtureResponseController.enqueue(new TextEncoder().encode('second chunk'));
globalThis.fixtureResponseController.close();
assert.equal(await streamed.text(), 'first chunksecond chunk');
const paused = await cloudflareWorker.fetch(new Request(url, { headers: { 'X-Riparim-Release-Commit': 'f'.repeat(40) } }), { ...env, MIGRATION_READ_ONLY: 'true', MIGRATION_SOURCE_COMMIT: 'f'.repeat(40) }, ctx);
assert.equal(paused.status, 503);
assert.equal(paused.headers.get('X-Riparim-Migration-Read-Only'), 'true');
assert.equal(paused.headers.get('X-Riparim-Release-Commit'), releaseCommit, 'maintenance and regular response identity share the baked commit');

for (const [name, define] of [
  ['unbaked', { 'import.meta.env.DEV': 'false' }],
  ['invalid', { 'import.meta.env.DEV': 'false', __RIPARIM_RELEASE_COMMIT__: JSON.stringify('invalid-release-commit') }],
]) {
  const variant = await build({ ...bundleOptions, entryPoints: ['build/cloudflare-worker.ts'], outdir: `.test-runtime/cloudflare-request/${name}`, define });
  const filename = variant.outputFiles[0].path.replace(/\.js$/, '.mjs');
  await mkdir(new URL('.', pathToFileURL(filename)), { recursive: true });
  await writeFile(filename, variant.outputFiles[0].contents);
  const { default: worker } = await import(pathToFileURL(filename));
  const result = await worker.fetch(new Request(`${url}&fixture-response=html`, { headers: { 'X-Riparim-Release-Commit': 'f'.repeat(40) } }), { ...env, MIGRATION_SOURCE_COMMIT: 'f'.repeat(40) }, ctx);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('X-Riparim-Release-Commit'), null, 'unbaked and invalid builds must not claim a client or environment commit');
  const unavailable = await worker.fetch(new Request(url), { ...env, MIGRATION_READ_ONLY: 'true', MIGRATION_SOURCE_COMMIT: 'f'.repeat(40) }, ctx);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('X-Riparim-Release-Commit'), null);
}
// Native workerd headers and immutable redirect responses must retain the same
// contracts as the compiled wrapper tested above. No provider fetches occur.
const nativeRuntime = new Miniflare({ modules: true, script: bundle.outputFiles.find(file => file.path.endsWith('/build/cloudflare-worker.js')).text,
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'] });
try {
  for (const mode of ['html', 'json', 'redirect', 'unavailable']) {
    const result = await nativeRuntime.dispatchFetch(`http://fixture/?fixture-response=${mode}`, { redirect: 'manual', headers: { 'X-Riparim-Release-Commit': 'f'.repeat(40) } });
    assert.equal(result.headers.get('X-Riparim-Release-Commit'), releaseCommit);
    assert.equal(result.status, mode === 'redirect' ? 303 : mode === 'unavailable' ? 503 : 200);
    if (mode === 'redirect') assert.equal(result.headers.get('Location'), 'https://riparim.com/einstellungen?weiter=%2Fbetrieb');
    else {
      assert.equal(result.headers.getSetCookie().length, 2, 'native Worker provenance must preserve separate cookie fields');
      assert.equal(result.headers.getSetCookie()[1], 'riparim-google-flow=; Path=/auth/bestaetigen; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure');
      assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
      if (mode === 'json') assert.deepEqual(await result.json(), { fixture: true });
      else assert.equal(await result.text(), '<!doctype html><title>Fixture</title>');
    }
  }
} finally { await nativeRuntime.dispose(); }
console.log('Cloudflare request boundary: immutable release provenance preserves streams, cookies and redirects; canonical www routing, forged identity removal and Sites identity behavior passed');
