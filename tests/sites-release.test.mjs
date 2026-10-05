import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageRelease } from "../scripts/package-release.mjs";
import { assertSitesBuildConfig, releaseBuildTarget, sitesBuildConfiguration, sitesProjectId } from "../scripts/release-policy.mjs";

const hosting = { project_id: sitesProjectId, d1: "DB", r2: "BUCKET" };
const source = sitesBuildConfiguration(hosting);
const generated = { ...source, main: "index.js", no_bundle: true, assets: { directory: "../client" } };
assert.equal(releaseBuildTarget(), "cloudflare");
assert.equal(releaseBuildTarget("sites"), "sites");
for (const value of ["", "production", "preview", "Sites"]) assert.throws(() => releaseBuildTarget(value));
for (const change of [{ project_id: "another-site" }, { d1: "another-binding" }, { r2: null }]) assert.throws(() => sitesBuildConfiguration({ ...hosting, ...change }));
assert.equal(source.main, "./build/sites-worker.ts");
assert.equal(source.vars.SITE_ORIGIN, "https://riparim.com");
assert.equal(source.d1_databases[0].binding, hosting.d1);
assert.equal(source.r2_buckets[0].binding, hosting.r2);
assert.doesNotThrow(() => assertSitesBuildConfig(hosting, generated));
const unsafeChanges = [
  { account_id: "owned-account" }, { name: "owned-worker" }, { main: "../client/index.js" }, { no_bundle: false },
  { vars: { SITE_ORIGIN: "https://fixture.workers.dev" } }, { vars: { ...source.vars, PRIVATE_VALUE: "isolated-fixture" } },
  { services: [{ binding: "CONNECTORS", service: "preview-service" }] }, { routes: [{ pattern: "fixture.example/*" }] },
  { kv_namespaces: [{ binding: "private-binding", id: "owned-resource" }] }, { dispatch_namespaces: [{ binding: "dispatch", namespace: "owned-resource" }] },
  { durable_objects: { bindings: [{ name: "private-binding", class_name: "OwnedObject" }] } }, { queues: { producers: [{ binding: "private-binding", queue: "owned-queue" }] } },
  { env: { preview: {} } }, { build: { command: "npm run build" } }, { dispatch_namespace: "fixture" },
  { unsafe: { bindings: [] } }, { workers_dev: true }, { preview_urls: true }, { triggers: {} },
  { compatibility_flags: [] }, { compatibility_date: "2000-01-01" }, { assets: { directory: "../../" } },
  { d1_databases: [{ ...source.d1_databases[0], database_id: "production-resource" }] },
  { d1_databases: [{ ...source.d1_databases[0], remote: true }] },
  { d1_databases: [{ ...source.d1_databases[0], preview_database_id: "preview-resource" }] },
  { r2_buckets: [{ ...source.r2_buckets[0], bucket_name: "production-bucket" }] },
  { r2_buckets: [{ ...source.r2_buckets[0], preview_bucket_name: "preview-bucket" }] },
  { r2_buckets: [{ ...source.r2_buckets[0], remote: true }] },
];
for (const change of unsafeChanges) assert.throws(() => assertSitesBuildConfig(hosting, { ...generated, ...change }));
for (const name of ["ai", "browser", "images", "media", "stream"]) assert.throws(() => assertSitesBuildConfig(hosting, { ...generated, [name]: { binding: "private-binding", remote: true } }));
for (const name of ["artifacts", "containers", "flagship", "ratelimits"]) assert.throws(() => assertSitesBuildConfig(hosting, { ...generated, [name]: [{ binding: "private-binding" }] }));

// Exercise real packaging with isolated files and Git history. No source database,
// evidence object, credential or deployment operation is read by this fixture.
const root = await mkdtemp(join(tmpdir(), "riparim-sites-release-"));
const json = async (path, value) => writeFile(join(root, path), `${JSON.stringify(value)}\n`);
const cloudflareSource = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
try {
  for (const path of [".openai", "dist/.openai/drizzle", "dist/server", "dist/client/.vite"]) await mkdir(join(root, path), { recursive: true });
  await json(".openai/hosting.json", hosting);
  await json("wrangler.jsonc", cloudflareSource);
  await json("dist/.openai/hosting.json", hosting);
  await json("dist/server/wrangler.json", generated);
  await json("dist/client/.vite/manifest.json", {});
  await writeFile(join(root, "dist/client/fixture.js"), "/* isolated client */\n");
  await writeFile(join(root, "dist/server/index.js"), "export default { fetch() { return new Response('fixture'); } };\n");
  await writeFile(join(root, "dist/.openai/drizzle/0000_fixture.sql"), "CREATE TABLE fixture (id TEXT PRIMARY KEY);\n");
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  await writeFile(join(root, ".gitignore"), "dist/\nartifacts/\n");
  execFileSync("git", ["add", ".gitignore", ".openai/hosting.json", "wrangler.jsonc"], { cwd: root });
  execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "test: initialize isolated fixture"], { cwd: root });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  await assert.rejects(() => packageRelease({ projectRoot: root, target: "sites", workflowCommit: "a".repeat(40) }), /workflow commit/);
  await writeFile(join(root, "uncommitted-source.mjs"), "/* isolated uncommitted source */\n");
  await assert.rejects(() => packageRelease({ projectRoot: root, target: "sites", workflowCommit: commit }), /clean committed source/);
  await rm(join(root, "uncommitted-source.mjs"));
  await json("dist/server/wrangler.json", { ...cloudflareSource, main: "index.js", no_bundle: true, assets: { ...cloudflareSource.assets, directory: "../client" } });
  const owned = await packageRelease({ projectRoot: root, target: "cloudflare", workflowCommit: commit });
  const ownedArchive = await readFile(owned.archive);
  const ownedProvenance = await readFile(owned.provenancePath);
  assert.equal(owned.provenance.provider, "cloudflare");
  await assert.rejects(() => packageRelease({ projectRoot: root, target: "sites", workflowCommit: commit }), /logical bindings/);
  await json("dist/server/wrangler.json", generated);
  const packaged = await packageRelease({ projectRoot: root, target: "sites", workflowCommit: commit });
  assert.deepEqual(await readFile(owned.archive), ownedArchive, "Sites packaging must preserve the exact already-verified owned Worker bytes.");
  assert.deepEqual(await readFile(owned.provenancePath), ownedProvenance);
  assert.equal(packaged.provenance.provider, "sites");
  assert.equal(packaged.provenance.project_id, sitesProjectId);
  assert.equal(packaged.provenance.commit, commit);
  assert.equal(packaged.provenance.sha256, createHash("sha256").update(await readFile(packaged.archive)).digest("hex"));
  const entries = execFileSync("tar", ["-tzf", packaged.archive], { encoding: "utf8" }).split("\n");
  for (const entry of ["dist/.openai/hosting.json", "dist/.openai/drizzle/0000_fixture.sql", "dist/server/index.js", "dist/server/wrangler.json", "dist/client/fixture.js"]) assert(entries.includes(entry), entry);
  assert(!entries.some(entry => entry.startsWith(".git/") || entry.startsWith("scripts/")));
  assert.deepEqual(JSON.parse(execFileSync("tar", ["-xOzf", packaged.archive, "dist/.openai/hosting.json"], { encoding: "utf8" })), hosting);
  // A second target must never overwrite the previously packaged companion.
  const originalArchive = await readFile(packaged.archive);
  await assert.rejects(() => packageRelease({ projectRoot: root, target: "cloudflare", workflowCommit: commit }));
  assert.deepEqual(await readFile(packaged.archive), originalArchive);
  await json("dist/.openai/hosting.json", { ...hosting, r2: "different-binding" });
  await assert.rejects(() => packageRelease({ projectRoot: root, target: "sites", workflowCommit: commit }), /logical bindings/);
  await json("dist/.openai/hosting.json", hosting);
  await json("dist/server/wrangler.json", { ...generated, account_id: "owned-account" });
  await assert.rejects(() => packageRelease({ projectRoot: root, target: "sites", workflowCommit: commit }), /owned-account/);
  await json("dist/server/wrangler.json", generated);
  await symlink(join(root, ".openai/hosting.json"), join(root, "dist/client/fixture-link"));
  await assert.rejects(() => packageRelease({ projectRoot: root, target: "sites", workflowCommit: commit }), /symlink/);
  assert.deepEqual(await readFile(packaged.archive), originalArchive);
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("Sites companion: target isolation, provenance, logical bindings, archive layout and safe packaging passed; no remote operations executed.");
