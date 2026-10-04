import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import config from "../release.config.mjs";
import { assertBuildProvenance, assertReleaseContext, existingReleaseMetadata } from "../scripts/release-policy.mjs";

const commit = "a".repeat(40), sha256 = "b".repeat(64);
const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "ramiz4/riparim", GITHUB_SHA: commit };
assert.doesNotThrow(() => assertReleaseContext(env, commit));
for (const change of [{ GITHUB_ACTIONS: undefined }, { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_EVENT_NAME: "workflow_dispatch" }, { GITHUB_REF: "refs/heads/codex/feature" }, { GITHUB_REPOSITORY: "someone/fork" }, { GITHUB_SHA: "c".repeat(40) }]) {
  assert.throws(() => assertReleaseContext({ ...env, ...change }, commit));
}
const provenance = { repository: env.GITHUB_REPOSITORY, commit, sha256 };
assert.doesNotThrow(() => assertBuildProvenance(provenance, commit, sha256));
for (const change of [{ repository: "someone/fork" }, { commit: "c".repeat(40) }, { sha256: "d".repeat(64) }]) assert.throws(() => assertBuildProvenance({ ...provenance, ...change }, commit, sha256));

const tag = "v1.2.3", release = { tag_name: tag, draft: false, prerelease: false, assets: [{ name: `riparim-${tag}.tar.gz`, state: "uploaded", size: 123 }, { name: `riparim-${tag}.json`, state: "uploaded", size: 100 }] };
assert.deepEqual(existingReleaseMetadata(release, tag, commit), { version: "1.2.3", gitTag: tag, gitHead: commit });
for (const change of [{ draft: true }, { prerelease: true }, { tag_name: "v1.2.4" }, { assets: [] }, { assets: release.assets.slice(0, 1) }]) assert.throws(() => existingReleaseMetadata({ ...release, ...change }, tag, commit));

for (const [message, expected] of [["fix: repair theme", "patch"], ["feat: add settings", "minor"], ["feat!: replace API", "major"], ["fix: replace API\n\nBREAKING CHANGE: remove old API", "major"], ["docs: update guide", null], ["chore: update tools", null]]) {
  const lint = spawnSync(process.execPath, ["node_modules/@commitlint/cli/cli.js"], { input: message, encoding: "utf8" });
  assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  assert.equal(await analyzeCommits(config.plugins[0][1], { cwd: process.cwd(), commits: [{ message, hash: commit }], logger: { log() {} } }), expected);
}
assert.notEqual(spawnSync(process.execPath, ["node_modules/@commitlint/cli/cli.js"], { input: "Update Site source", encoding: "utf8" }).status, 0);
console.log("Release policy: main-only context, exact build, retries and Conventional Commit versioning passed.");
