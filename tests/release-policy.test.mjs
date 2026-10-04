import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
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

// Exercise the real writer as well as the analyzer: a preset can parse commits
// successfully while requiring a newer changelog writer at release time.
const noteMessages = [
  "feat(catalogue): add fixture filters",
  "fix(auth): restore fixture session",
  "feat(api)!: replace fixture response\n\nBREAKING CHANGE: fixture clients must migrate to the new response shape",
  "docs: revise fixture maintenance guide",
  "chore: refresh fixture tooling",
];
const notes = await generateNotes(config.plugins[1][1], {
  cwd: process.cwd(),
  options: { repositoryUrl: config.repositoryUrl },
  commits: noteMessages.map((message, index) => ({ message, hash: String(index + 1).repeat(40) })),
  lastRelease: { gitTag: "v1.2.2", gitHead: "f".repeat(40) },
  nextRelease: { version: "2.0.0", gitTag: "v2.0.0", gitHead: "6".repeat(40) },
  logger: { log() {} },
});
assert.match(notes, /### Features/);
assert.match(notes, /### Bug Fixes/);
assert.match(notes, /^### [^\n]*BREAKING CHANGES$/m);
for (const subject of ["add fixture filters", "restore fixture session", "replace fixture response", "fixture clients must migrate to the new response shape"]) assert(notes.includes(subject));
assert(notes.includes("https://github.com/ramiz4/riparim/compare/v1.2.2...v2.0.0"), "release notes must link the previous and next version tags");
for (const subject of ["revise fixture maintenance guide", "refresh fixture tooling"]) assert(!notes.includes(subject), "maintenance-only commits must stay out of release notes");
console.log("Release policy: main-only context, exact build, retries, Conventional Commit versioning and rendered release notes passed.");
