import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { deployCloudflare } from "../scripts/deploy-cloudflare.mjs";
import { assertCloudflareDeployConfig, assertCloudflareDeployContext, cloudflareProduction, isNewerPublishedRelease, parseWorkerSecrets } from "../scripts/cloudflare-deploy-policy.mjs";

const commit = "a".repeat(40);
const tag = "v1.2.3";
const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "ramiz4/riparim", GITHUB_SHA: commit, RELEASE_TAG: tag, GITHUB_TOKEN: "fixture-github-token", GH_TOKEN: "fixture-gh-token", CLOUDFLARE_API_TOKEN: "fixture-api-token" };
function publishedRelease(version) {
  return {
    tag_name: version,
    draft: false,
    prerelease: false,
    published_at: "2026-10-04T10:00:00Z",
    assets: [
      { name: `riparim-${version}.tar.gz`, state: "uploaded", size: 123 },
      { name: `riparim-${version}.json`, state: "uploaded", size: 100 },
    ],
  };
}
assert.equal(isNewerPublishedRelease(publishedRelease(tag), tag), false);
assert.equal(isNewerPublishedRelease(publishedRelease("v1.2.2"), tag), false);
assert.equal(isNewerPublishedRelease(publishedRelease("v1.2.10"), tag), true);
assert.equal(isNewerPublishedRelease(publishedRelease("v1.10.0"), tag), true);
assert.equal(isNewerPublishedRelease(publishedRelease("v2.0.0"), "v1.99.99"), true);
assert.equal(isNewerPublishedRelease(publishedRelease("v1.2.9007199254740993"), "v1.2.9007199254740992"), true);
const source = {
  account_id: cloudflareProduction.account,
  name: cloudflareProduction.worker,
  main: "build/cloudflare-worker.ts",
  workers_dev: true,
  preview_urls: false,
  routes: [],
  triggers: {crons:["*/5 * * * *"]},
  vars: { SITE_ORIGIN: cloudflareProduction.origin },
  d1_databases: [{ binding: "DB", database_id: cloudflareProduction.database, database_name: cloudflareProduction.databaseName, migrations_dir: "drizzle", remote: false }],
  r2_buckets: [{ binding: "BUCKET", bucket_name: cloudflareProduction.bucket, remote: false }],
};
const generated = { ...source, main: "index.js", no_bundle: true, assets: { directory: "../client" } };
assert.doesNotThrow(() => assertCloudflareDeployContext(env, commit, commit));
for (const change of [{ GITHUB_ACTIONS: "false" }, { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_EVENT_NAME: "workflow_dispatch" }, { GITHUB_REF: "refs/heads/codex/feature" }, { GITHUB_REPOSITORY: "someone/fork" }, { GITHUB_SHA: "b".repeat(40) }, { RELEASE_TAG: "v1.2.3-beta.1" }, { RELEASE_TAG: "v01.2.3" }, { RELEASE_TAG: "main" }]) {
  assert.throws(() => assertCloudflareDeployContext({ ...env, ...change }, commit, commit));
}
assert.throws(() => assertCloudflareDeployContext(env, commit, "b".repeat(40)));
assert.doesNotThrow(() => assertCloudflareDeployConfig(source, generated));
const checkedInConfig = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
assert.equal(checkedInConfig.vars.SITE_ORIGIN, cloudflareProduction.origin);
assert.equal(checkedInConfig.workers_dev, true, "the protected final transfer still needs its technical host");
assert.equal(checkedInConfig.preview_urls, false);
// The final routing release binds only the two approved production hosts.
// Source/generated agreement must not authorize a foreign or wider route.
const productionRoutes = [
  { pattern: "riparim.com", zone_id: cloudflareProduction.zone, custom_domain: true, enabled: true, previews_enabled: false },
  { pattern: "www.riparim.com", zone_id: cloudflareProduction.zone, custom_domain: true, enabled: true, previews_enabled: false },
];
assert.deepEqual(checkedInConfig.routes, productionRoutes, "the owned production zone must bind only enabled apex/www domains without previews");
const routedSource = { ...source, routes: productionRoutes };
const routedGenerated = { ...generated, routes: productionRoutes };
assert.doesNotThrow(() => assertCloudflareDeployConfig(routedSource, routedGenerated));
assert.doesNotThrow(() => assertCloudflareDeployConfig({ ...routedSource, workers_dev: false }, { ...routedGenerated, workers_dev: false }));
for (const routes of [
  productionRoutes.slice(0, 1),
  [...productionRoutes, { ...productionRoutes[0], pattern: "api.riparim.com" }],
  [productionRoutes[0], productionRoutes[0]],
  productionRoutes.map(route => ({ ...route, pattern: `${route.pattern}/*` })),
  productionRoutes.map(route => ({ ...route, pattern: "*.riparim.com" })),
  productionRoutes.map(route => ({ ...route, zone_id: "foreign-zone" })),
  productionRoutes.map(route => ({ ...route, custom_domain: false })),
  productionRoutes.map(route => ({ ...route, enabled: false })),
  productionRoutes.map(route => ({ ...route, previews_enabled: true })),
  ["riparim.com", "www.riparim.com"],
]) assert.throws(() => assertCloudflareDeployConfig({ ...source, routes }, { ...generated, routes }), /production routing/i);
for (const [input, output] of [
  [source, routedGenerated],
  [routedSource, generated],
  [routedSource, { ...routedGenerated, routes: productionRoutes.slice(0, 1) }],
  [routedSource, { ...routedGenerated, routes: [{ pattern: "other.example", custom_domain: true }] }],
  [routedSource, { ...routedGenerated, routes: productionRoutes.map(route => ({ ...route, custom_domain: false })) }],
  [source, { ...generated, route: "riparim.com/*" }],
  [{ ...source, route: "riparim.com/*" }, { ...generated, route: "riparim.com/*" }],
  [source, { ...generated, routes: null }],
  [{ ...source, workers_dev: false }, generated],
  [source, { ...generated, workers_dev: false }],
  [{ ...source, workers_dev: undefined }, { ...generated, workers_dev: undefined }],
  [source, { ...generated, preview_urls: true }],
  [{ ...source, preview_urls: true }, { ...generated, preview_urls: true }],
  [{ ...source, preview_urls: undefined }, { ...generated, preview_urls: undefined }],
  [{ ...source, vars: { SITE_ORIGIN: "https://fixture.workers.dev" } }, { ...generated, vars: { SITE_ORIGIN: "https://fixture.workers.dev" } }],
]) assert.throws(() => assertCloudflareDeployConfig(input, output));
for (const change of [{ name: "another-worker" }, { account_id: "wrong-account" }, { services: [{ binding: "CONNECTORS", service: "sites-connector-preview" }] }, { main: "../../app/page.tsx" }, { no_bundle: false }, { build: { command: "npm run build" } }, { vars: {} }, { triggers: {} }, { assets: { directory: "../../../" } }, { env: { preview: {} } }, { d1_databases: [{ ...source.d1_databases[0], database_id: "00000000-0000-4000-8000-000000000000" }] }, { r2_buckets: [{ ...source.r2_buckets[0], bucket_name: "preview-bucket" }] }]) {
  assert.throws(() => assertCloudflareDeployConfig(source, { ...generated, ...change }));
}
assert.throws(() => assertCloudflareDeployConfig({ ...source, main: "build/sites-worker.ts" }, generated));
for (const invalid of ["fixture-private-value", "[]", "null", '{"GOOGLE_PLACES_SERVER_API_KEY":null}', '{"GOOGLE_PLACES_SERVER_API_KEY":{"value":"fixture-private-value"}}', '{"token":"fixture-private-value"}', '{"CF_API_TOKEN":"fixture-private-value"}', '{"CLOUDFLARE_API_TOKEN":"fixture-private-value"}', '{"SITE_ORIGIN":"fixture-private-value"}']) {
  assert.throws(() => parseWorkerSecrets(invalid), error => !error.message.includes("fixture-private-value"));
}
assert.deepEqual(parseWorkerSecrets('{"GOOGLE_PLACES_SERVER_API_KEY":"fixture-private-value"}'), { GOOGLE_PLACES_SERVER_API_KEY: "fixture-private-value" });
assert.deepEqual(parseWorkerSecrets('{"RESEND_API_KEY":"re_fixture_key","TRANSACTIONAL_EMAIL_FROM":"Riparim <fixture@example.test>"}'), {RESEND_API_KEY:"re_fixture_key",TRANSACTIONAL_EMAIL_FROM:"Riparim <fixture@example.test>"});
assert.equal(parseWorkerSecrets(""), null);

// Small USTAR fixtures let the real platform tar tool inspect malicious entry
// types and traversal paths without ever contacting GitHub or Cloudflare.
function tarEntry(name, content = "", type = "0", link = "") {
  const data = Buffer.from(content);
  const header = Buffer.alloc(512);
  const text = (value, offset, length) => header.write(value, offset, length, "ascii");
  text(name, 0, 100);
  text("0000644\0", 100, 8);
  text("0000000\0", 108, 8);
  text("0000000\0", 116, 8);
  text(`${data.length.toString(8).padStart(11, "0")}\0`, 124, 12);
  text("00000000000\0", 136, 12);
  header.fill(32, 148, 156);
  text(type, 156, 1);
  text(link, 157, 100);
  text("ustar\0", 257, 6);
  text("00", 263, 2);
  const checksum = [...header].reduce((sum, value) => sum + value, 0);
  text(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)]);
}

const fixtureRoot = await mkdtemp(join(tmpdir(), "riparim-cloudflare-deploy-test-"));
const expectedCode = "export default { fetch() { return new Response('published fixture bytes'); } };";
let extraEntries = [];
let fixtureConfig = generated;
let fixtureProvider = "cloudflare";
const archive = join(fixtureRoot, "artifacts/riparim-worker.tar.gz");
async function makeRelease() {
  const bytes = gzipSync(Buffer.concat([
    tarEntry("dist/server/index.js", expectedCode),
    tarEntry("dist/server/wrangler.json", JSON.stringify(fixtureConfig)),
    tarEntry("dist/client/fixture.js", "published-client-bytes"),
    ...extraEntries,
    Buffer.alloc(1024),
  ]));
  await writeFile(archive, bytes);
  await writeFile(join(fixtureRoot, "artifacts/provenance.json"), JSON.stringify({ repository: env.GITHUB_REPOSITORY, commit, provider: fixtureProvider, sha256: createHash("sha256").update(bytes).digest("hex") }));
}

let currentMain = commit;
let resolvedTag = commit;
let failOperation = "";
let secretFile;
let remoteOperations = [];
let latestRelease = publishedRelease(tag);
let releaseSequence = [];
let lookupFailure = false;
let lookupStatus = 200;
let invalidJson = false;
async function fixtureRequest(url, options) {
  assert.equal(url, "https://api.github.com/repos/ramiz4/riparim/releases/latest");
  assert.equal(options.headers.Authorization, `Bearer ${env.GITHUB_TOKEN}`);
  assert.equal(options.headers.Accept, "application/vnd.github+json");
  assert(options.signal instanceof AbortSignal, "GitHub lookup must have a bounded timeout");
  if (lookupFailure) throw new Error("fixture-private-value: network failure");
  const release = releaseSequence.length ? releaseSequence.shift() : latestRelease;
  return new Response(invalidJson ? "fixture-private-value: invalid JSON" : JSON.stringify(release), { status: lookupStatus });
}
function fixtureRun(command, args, options) {
  assert.equal(options.env.GITHUB_TOKEN, undefined, "GitHub authorization must not leak into child processes");
  assert.equal(options.env.GH_TOKEN, undefined, "GitHub CLI authorization must not leak into child processes");
  if (command === "git") {
    if (args[0] === "ls-remote") return `${currentMain}\trefs/heads/main\n`;
    return `${args.includes("HEAD") ? commit : resolvedTag}\n`;
  }
  if (command === "tar") return execFileSync(command, args, { ...options, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(command, process.execPath);
  assert.equal(args[0], join(fixtureRoot, "node_modules/wrangler/bin/wrangler.js"), "deployment must use the pinned local Wrangler");
  assert.equal(options.env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_API_TOKEN);
  assert.equal(options.env.WRANGLER_WRITE_LOGS, "false");
  assert.equal(options.env.CLOUDFLARE_WORKER_SECRETS, undefined, "secret JSON must not leak into the Wrangler environment");
  if (args[1] === "d1") {
    remoteOperations.push("migrations");
    assert.deepEqual(args.slice(1), ["d1", "migrations", "apply", "DB", "--remote", "--config", join(fixtureRoot, "wrangler.jsonc")]);
  } else {
    remoteOperations.push("deploy");
    assert.equal(args[1], "deploy");
    assert(args.includes("--no-bundle") && args.includes("--keep-vars"));
    assert(args.includes("--experimental-provision=false"), "production deployment must use pre-created bindings without automatic resource provisioning");
    assert.equal(args[args.indexOf("--tag") + 1], tag);
    assert.equal(args[args.indexOf("--message") + 1], `${tag} (${commit})`);
    const configPath = args[args.indexOf("--config") + 1];
    assert(relative(join(fixtureRoot, ".sites-runtime/release-deploy"), configPath).startsWith("release-"));
    assert.equal(readFileSync(join(dirname(configPath), "index.js"), "utf8"), expectedCode, "deployment must use the published archive, never rebuilt source");
    if (args.includes("--secrets-file")) {
      secretFile = args[args.indexOf("--secrets-file") + 1];
      assert(!secretFile.startsWith(fixtureRoot), "temporary secrets must remain outside the release archive");
      assert.equal(statSync(secretFile).mode & 0o777, 0o600);
      assert.deepEqual(JSON.parse(readFileSync(secretFile, "utf8")), { GOOGLE_PLACES_SERVER_API_KEY: "fixture-private-value" });
      assert(!args.join(" ").includes("fixture-private-value"));
    }
  }
  if (failOperation === remoteOperations.at(-1)) throw new Error("fixture-private-value: provider failure");
  return "";
}
const deploy = overrides => deployCloudflare({ root: fixtureRoot, env: { ...env, ...overrides }, run: fixtureRun, request: fixtureRequest });

try {
  await mkdir(join(fixtureRoot, "artifacts"), { recursive: true });
  await mkdir(join(fixtureRoot, "node_modules/wrangler"), { recursive: true });
  await mkdir(join(fixtureRoot, "drizzle"));
  await writeFile(join(fixtureRoot, "wrangler.jsonc"), JSON.stringify(source));
  await writeFile(join(fixtureRoot, "package.json"), '{"devDependencies":{"wrangler":"4.92.0"}}');
  await writeFile(join(fixtureRoot, "node_modules/wrangler/package.json"), '{"version":"4.92.0"}');
  await makeRelease();
  const output = join(fixtureRoot, "github-output");
  const withSecrets = { CLOUDFLARE_WORKER_SECRETS: '{"GOOGLE_PLACES_SERVER_API_KEY":"fixture-private-value"}', GITHUB_OUTPUT: output };
  assert.deepEqual(await deploy(withSecrets), { deployed: true, tag, commit });
  assert.deepEqual(remoteOperations, ["migrations", "deploy"]);
  assert.equal(existsSync(secretFile), false, "secrets must be removed after successful deployment");
  assert.match(await readFile(output, "utf8"), /deployed=true/);
  remoteOperations = [];
  assert.equal((await deploy()).deployed, true, "retry must deploy the same downloaded release without rebuilding");
  assert.deepEqual(remoteOperations, ["migrations", "deploy"]);

  remoteOperations = [];
  currentMain = "b".repeat(40);
  assert.deepEqual(await deploy(), { deployed: true, tag, commit }, "new docs/chore commits on main must not strand an already published release");
  assert.deepEqual(remoteOperations, ["migrations", "deploy"]);
  remoteOperations = [];
  latestRelease = publishedRelease("v1.2.4");
  assert.deepEqual(await deploy(), { deployed: false, reason: "superseded" });
  assert.deepEqual(remoteOperations, []);
  latestRelease = publishedRelease(tag);
  await assert.rejects(deploy({ GITHUB_TOKEN: "" }), /read-only GitHub token/);
  lookupFailure = true;
  await assert.rejects(deploy(), error => /could not be verified/.test(error.message) && !error.message.includes("fixture-private-value"));
  lookupFailure = false;
  for (const status of [403, 404, 500]) {
    lookupStatus = status;
    await assert.rejects(deploy(), /could not be verified/);
  }
  lookupStatus = 200;
  invalidJson = true;
  await assert.rejects(deploy(), error => /could not be verified/.test(error.message) && !error.message.includes("fixture-private-value"));
  invalidJson = false;
  for (const change of [{ tag_name: "v01.2.4" }, { tag_name: "v1.2.4-beta.1" }, { tag_name: "main" }, { draft: true }, { prerelease: true }, { published_at: null }, { published_at: "invalid" }, { assets: null }, { assets: [] }, { assets: publishedRelease("v1.2.4").assets.slice(0, 1) }]) {
    latestRelease = { ...publishedRelease("v1.2.4"), ...change };
    await assert.rejects(deploy(), /metadata|incomplete/);
  }
  assert.deepEqual(remoteOperations, [], "API failures and invalid or partial publication must never touch production");
  latestRelease = publishedRelease(tag);

  // A publication appearing after extraction must still fence a stale retry,
  // and temporary application secrets must be removed on this early return.
  const secretsBeforeFence = await readdir(join(tmpdir()));
  releaseSequence = [publishedRelease(tag), publishedRelease("v1.2.4")];
  assert.deepEqual(await deploy(withSecrets), { deployed: false, reason: "superseded" });
  assert.deepEqual(remoteOperations, []);
  assert.deepEqual((await readdir(join(tmpdir()))).filter(name => name.startsWith("riparim-worker-secrets-") && !secretsBeforeFence.includes(name)), []);

  // Recheck immediately before upload, after migrations, to stop an older
  // deploy-only rerun from replacing a newer published application release.
  releaseSequence = [publishedRelease(tag), publishedRelease(tag), publishedRelease("v1.2.4")];
  assert.deepEqual(await deploy(), { deployed: false, reason: "superseded" });
  assert.deepEqual(remoteOperations, ["migrations"]);
  remoteOperations = [];
  currentMain = commit;
  await writeFile(join(fixtureRoot, "package.json"), '{"devDependencies":{"wrangler":"^4.92.0"}}');
  await assert.rejects(deploy(), /exact Wrangler version pinned in package.json/);
  await writeFile(join(fixtureRoot, "package.json"), '{"devDependencies":{"wrangler":"4.92.0"}}');
  await writeFile(join(fixtureRoot, "node_modules/wrangler/package.json"), '{"version":"4.93.0"}');
  await assert.rejects(deploy(), /exact Wrangler version pinned in package.json/);
  await writeFile(join(fixtureRoot, "node_modules/wrangler/package.json"), '{"version":"4.92.0"}');
  resolvedTag = "b".repeat(40);
  await assert.rejects(deploy(), /exact main workflow commit/);
  resolvedTag = commit;
  await assert.rejects(deploy({ GITHUB_REF: "refs/heads/codex/feature" }));
  fixtureProvider = "sites";
  await makeRelease();
  await assert.rejects(deploy(), /owned Cloudflare build/);
  fixtureProvider = "cloudflare";
  await makeRelease();
  await writeFile(archive, Buffer.concat([await readFile(archive), Buffer.from("tampered")]));
  await assert.rejects(deploy(), /SHA-256/);

  for (const entry of [tarEntry("../outside", "bad"), tarEntry("dist/../outside", "bad"), tarEntry("/tmp/outside", "bad"), tarEntry("dist/server/link", "", "2", "../../outside"), tarEntry("dist/server/hardlink", "", "1", "dist/server/index.js"), tarEntry("dist/server/special", "", "6"), tarEntry("dist/server/index.js", "duplicate")]) {
    extraEntries = [entry];
    await makeRelease();
    await assert.rejects(deploy(), /unsafe path/);
  }
  extraEntries = [];
  fixtureConfig = { ...generated, services: [{ binding: "CONNECTORS", service: "sites-connector-preview" }] };
  await makeRelease();
  await assert.rejects(deploy(), /Preview services/);
  assert.deepEqual(remoteOperations, [], "untrusted contexts and artifacts must not touch remote infrastructure");
  fixtureConfig = generated;
  await makeRelease();
  for (const change of [
    { routes: productionRoutes },
    { route: "riparim.com/*" },
    { workers_dev: false },
    { preview_urls: true },
  ]) {
    fixtureConfig = { ...generated, ...change };
    await makeRelease();
    await assert.rejects(deploy(), /routing|technical-host|preview URLs/);
    assert.deepEqual(remoteOperations, [], "routing drift must fail before migrations or deployment");
  }
  fixtureConfig = generated;
  await makeRelease();
  failOperation = "migrations";
  await assert.rejects(deploy(), /D1 migrations failed; the Worker was not deployed/);
  assert.deepEqual(remoteOperations, ["migrations"]);
  remoteOperations = [];
  failOperation = "deploy";
  await assert.rejects(deploy(withSecrets), error => /Worker deployment failed/.test(error.message) && !error.message.includes("fixture-private-value"));
  assert.equal(existsSync(secretFile), false, "secrets must be removed after failed deployment");
  assert.deepEqual(remoteOperations, ["migrations", "deploy"]);
  console.log("Cloudflare deployment: main/release gating, published-release ordering, archive integrity, safe extraction, production bindings, ordered migrations and secret cleanup passed; no remote operations executed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
