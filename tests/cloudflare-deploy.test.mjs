import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { deployCloudflare } from "../scripts/deploy-cloudflare.mjs";
import { assertCloudflareDeployConfig, assertCloudflareDeployContext, cloudflareProduction, parseWorkerSecrets } from "../scripts/cloudflare-deploy-policy.mjs";

const commit = "a".repeat(40);
const tag = "v1.2.3";
const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "ramiz4/riparim", GITHUB_SHA: commit, RELEASE_TAG: tag, CLOUDFLARE_API_TOKEN: "fixture-api-token" };
const source = {
  account_id: cloudflareProduction.account,
  name: cloudflareProduction.worker,
  main: "build/cloudflare-worker.ts",
  vars: { SITE_ORIGIN: "https://riparim.example.test" },
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
for (const change of [{ name: "another-worker" }, { account_id: "wrong-account" }, { services: [{ binding: "CONNECTORS", service: "sites-connector-preview" }] }, { main: "../../app/page.tsx" }, { no_bundle: false }, { build: { command: "npm run build" } }, { vars: {} }, { assets: { directory: "../../../" } }, { env: { preview: {} } }, { d1_databases: [{ ...source.d1_databases[0], database_id: "00000000-0000-4000-8000-000000000000" }] }, { r2_buckets: [{ ...source.r2_buckets[0], bucket_name: "preview-bucket" }] }]) {
  assert.throws(() => assertCloudflareDeployConfig(source, { ...generated, ...change }));
}
assert.throws(() => assertCloudflareDeployConfig({ ...source, main: "build/sites-worker.ts" }, generated));
for (const invalid of ["fixture-private-value", "[]", "null", '{"GOOGLE_PLACES_SERVER_API_KEY":null}', '{"GOOGLE_PLACES_SERVER_API_KEY":{"value":"fixture-private-value"}}', '{"token":"fixture-private-value"}', '{"CF_API_TOKEN":"fixture-private-value"}', '{"CLOUDFLARE_API_TOKEN":"fixture-private-value"}', '{"SITE_ORIGIN":"fixture-private-value"}']) {
  assert.throws(() => parseWorkerSecrets(invalid), error => !error.message.includes("fixture-private-value"));
}
assert.deepEqual(parseWorkerSecrets('{"GOOGLE_PLACES_SERVER_API_KEY":"fixture-private-value"}'), { GOOGLE_PLACES_SERVER_API_KEY: "fixture-private-value" });
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
function fixtureRun(command, args, options) {
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
const deploy = overrides => deployCloudflare({ root: fixtureRoot, env: { ...env, ...overrides }, run: fixtureRun });

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
  assert.deepEqual(await deploy(), { deployed: false, reason: "superseded" });
  assert.deepEqual(remoteOperations, []);
  currentMain = "";
  await assert.rejects(deploy(), /Cannot determine origin\/main/);
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
  failOperation = "migrations";
  await assert.rejects(deploy(), /D1 migrations failed; the Worker was not deployed/);
  assert.deepEqual(remoteOperations, ["migrations"]);
  remoteOperations = [];
  failOperation = "deploy";
  await assert.rejects(deploy(withSecrets), error => /Worker deployment failed/.test(error.message) && !error.message.includes("fixture-private-value"));
  assert.equal(existsSync(secretFile), false, "secrets must be removed after failed deployment");
  assert.deepEqual(remoteOperations, ["migrations", "deploy"]);
  console.log("Cloudflare deployment: main/release gating, published archive integrity, safe extraction, production bindings, ordered migrations and secret cleanup passed; no remote operations executed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
