import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { assertCIVerification } from "../scripts/verify-ci-gate.mjs";
import { verifyCIArtifacts } from "../scripts/verify-ci-artifacts.mjs";

const ci = await readFile(".github/workflows/ci.yml", "utf8");
const job = (source, name) => {
  const match = source.match(
    new RegExp(
      `^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z-]*:|$(?![\\s\\S]))`,
      "m",
    ),
  );
  assert(match, `CI must execute its independent ${name} job`);
  return match[1];
};
const quality = job(ci, "quality");
const node = job(ci, "node");
const workers = job(ci, "workers");
const gateJob = job(ci, "verify");
assert.match(quality, /npm test -- --group core/);
assert.match(node, /npm test -- --group node/);
assert.match(gateJob, /name: Tests, types, lint and build/);
assert.match(gateJob, /needs: \[quality, node, workers\]/);
assert.match(gateJob, /if: \$\{\{ always\(\) \}\}/);
assert.match(gateJob, /node scripts\/verify-ci-gate\.mjs/);
assert.match(gateJob, /NEEDS_JSON: \$\{\{ toJSON\(needs\) \}\}/);
assert.match(quality, /go-version: "1\.27\.1"/);
for (const source of [node, workers]) {
  assert.doesNotMatch(source, /setup-go/);
  assert.doesNotMatch(source, /needs:/);
}
for (const command of [
  "format:check",
  "catalog:check",
  "npx tsc --noEmit",
  "npm run lint",
  "backups:worker:check",
])
  assert(quality.includes(command), `quality must retain ${command}`);
assert.equal((ci.match(/run: npm run build:node/g) ?? []).length, 1);
assert(
  node.indexOf("run: npm run build:node") <
    node.indexOf("npm test -- --group node"),
);
assert.match(node, /RIPARIM_NODE_PREBUILT: \$\{\{ github\.workspace \}\}/);
assert(
  node.indexOf("npm test -- --group node") <
    node.indexOf("node scripts/package-release.mjs node"),
);
assert.match(workers, /BUILD_TARGET: cloudflare/);
assert.match(workers, /BUILD_TARGET: sites/);
assert(
  workers.indexOf("BUILD_TARGET: cloudflare") <
    workers.indexOf('rmSync("dist"'),
);
assert.match(
  ci,
  /group: ci-\$\{\{ github\.ref \}\}\n  cancel-in-progress: true/,
);
assert.doesNotMatch(ci, /continue-on-error|paths-ignore:|paths:/);
console.log(
  "CI executes all checks in three independent jobs and preserves its required aggregate gate.",
);

const success = Object.fromEntries(
  ["quality", "node", "workers"].map((name) => [name, { result: "success" }]),
);
assert.doesNotThrow(() => assertCIVerification(success));
for (const name of Object.keys(success)) {
  for (const result of ["failure", "cancelled", "skipped", "", undefined])
    assert.throws(
      () => assertCIVerification({ ...success, [name]: { result } }),
      /must succeed/,
    );
  const missing = { ...success };
  delete missing[name];
  assert.throws(() => assertCIVerification(missing), /must succeed/);
}
for (const value of [
  null,
  {},
  { ...success, unexpected: { result: "success" } },
])
  assert.throws(() => assertCIVerification(value), /must succeed/);
const gate = (needs) =>
  spawnSync(process.execPath, ["scripts/verify-ci-gate.mjs"], {
    env: { ...process.env, NEEDS_JSON: JSON.stringify(needs) },
    encoding: "utf8",
  });
assert.equal(gate(success).status, 0);
assert.notEqual(gate({ ...success, node: { result: "skipped" } }).status, 0);
console.log(
  "Aggregate CLI rejects missing, failed, cancelled and skipped branches.",
);

const sha = "a".repeat(40);
const env = {
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REPOSITORY: "ramiz4/riparim",
  GITHUB_REPOSITORY_ID: "123",
  GITHUB_SHA: sha,
  GITHUB_RUN_ID: "456",
  GITHUB_RUN_ATTEMPT: "2",
  NODE_ARTIFACT_ID: "111",
  WORKERS_ARTIFACT_ID: "222",
  GITHUB_TOKEN: "fixture-token",
};
const run = {
  id: 456,
  head_sha: sha,
  head_branch: "main",
  event: "push",
  run_attempt: 2,
  path: ".github/workflows/release.yml",
  repository: { id: 123, full_name: "ramiz4/riparim" },
  head_repository: { id: 123, full_name: "ramiz4/riparim" },
};
const artifact = (id, group, attempt) => ({
  id,
  name: `${group}-${sha}-${attempt}`,
  size_in_bytes: 100,
  expired: false,
  workflow_run: {
    id: 456,
    repository_id: 123,
    head_repository_id: 123,
    head_branch: "main",
    head_sha: sha,
  },
});
const fixtures = {
  run,
  node: artifact(111, "node", 1),
  workers: artifact(222, "workers", 2),
};
async function verify({ values = fixtures, extraEnv = {}, failure } = {}) {
  const calls = [];
  const context = { ...env, ...extraEnv };
  const value = await verifyCIArtifacts({
    env: context,
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer fixture-token");
      calls.push(url);
      const endpoint = new URL(url).pathname;
      const response = endpoint.endsWith("/runs/456")
        ? values.run
        : endpoint.endsWith(`/artifacts/${context.NODE_ARTIFACT_ID}`)
          ? values.node
          : endpoint.endsWith(`/artifacts/${context.WORKERS_ARTIFACT_ID}`)
            ? values.workers
            : undefined;
      assert(response, `unexpected API endpoint ${endpoint}`);
      return {
        ok: !failure,
        status: failure || 200,
        json: async () => response,
      };
    },
  });
  assert.deepEqual(
    calls.sort(),
    [
      "https://api.github.com/repos/ramiz4/riparim/actions/runs/456",
      `https://api.github.com/repos/ramiz4/riparim/actions/artifacts/${context.NODE_ARTIFACT_ID}`,
      `https://api.github.com/repos/ramiz4/riparim/actions/artifacts/${context.WORKERS_ARTIFACT_ID}`,
    ].sort(),
    "only the exact supplied run and artifact IDs may be fetched",
  );
  return value;
}
assert.deepEqual(await verify(), {
  ids: "111,222",
  nodeAttempt: 1,
  workersAttempt: 2,
});
// Full reruns select only new producer IDs even while earlier artifacts exist.
assert.deepEqual(
  await verify({
    values: {
      run,
      node: artifact(333, "node", 2),
      workers: artifact(444, "workers", 2),
    },
    extraEnv: { NODE_ARTIFACT_ID: "333", WORKERS_ARTIFACT_ID: "444" },
  }),
  { ids: "333,444", nodeAttempt: 2, workersAttempt: 2 },
);
// Release-only retry retains both successful producers from a previous attempt.
assert.deepEqual(
  await verify({
    values: { ...fixtures, workers: artifact(222, "workers", 1) },
  }),
  {
    ids: "111,222",
    nodeAttempt: 1,
    workersAttempt: 1,
  },
);
for (const group of ["node", "workers"]) {
  for (const change of [
    { id: 999 },
    { expired: true },
    { expired: undefined },
    { size_in_bytes: 0 },
    { size_in_bytes: "100" },
    { workflow_run: undefined },
    ...[
      { id: 789 },
      { repository_id: 789 },
      { head_repository_id: 789 },
      { head_branch: "codex/fixture" },
      { head_sha: "b".repeat(40) },
    ].map((change) => ({
      workflow_run: { ...fixtures[group].workflow_run, ...change },
    })),
    ...[
      `${group}-${"b".repeat(40)}-1`,
      `other-${sha}-1`,
      `${group}-${sha}-3`,
      `${group}-${sha}-0`,
      `${group}-${sha}-01`,
      `${group}-${sha}-1-extra`,
    ].map((name) => ({ name })),
  ])
    await assert.rejects(
      verify({
        values: { ...fixtures, [group]: { ...fixtures[group], ...change } },
      }),
    );
}
for (const change of [
  { id: 999 },
  { head_sha: "b".repeat(40) },
  { head_branch: "codex/fixture" },
  { event: "pull_request" },
  { run_attempt: 3 },
  { path: ".github/workflows/ci.yml" },
  { repository: { ...run.repository, id: 789 } },
  { head_repository: { ...run.head_repository, id: 789 } },
  { repository: { ...run.repository, full_name: "someone/fork" } },
  { head_repository: { ...run.head_repository, full_name: "someone/fork" } },
])
  await assert.rejects(
    verify({ values: { ...fixtures, run: { ...run, ...change } } }),
    /exact trusted main/,
  );
for (const failure of [403, 404, 500])
  await assert.rejects(
    verify({ failure }),
    /Cannot validate producer metadata/,
  );
for (const extraEnv of [
  { NODE_ARTIFACT_ID: "" },
  { WORKERS_ARTIFACT_ID: "" },
  { NODE_ARTIFACT_ID: "222" },
  { NODE_ARTIFACT_ID: "01" },
  { WORKERS_ARTIFACT_ID: "111,222" },
  { NODE_ARTIFACT_ID: "9007199254740992" },
  { GITHUB_RUN_ID: "" },
  { GITHUB_REPOSITORY_ID: "" },
  { GITHUB_RUN_ATTEMPT: "" },
  { GITHUB_TOKEN: "" },
  { GITHUB_REF: "refs/heads/codex/fixture" },
  { GITHUB_EVENT_NAME: "pull_request" },
  { GITHUB_REPOSITORY: "someone/fork" },
]) {
  await assert.rejects(
    verifyCIArtifacts({
      env: { ...env, ...extraEnv },
      fetchImpl: () =>
        assert.fail(
          "Invalid/missing IDs or release context must fail before any API call",
        ),
    }),
  );
}
console.log(
  "Exact artifact IDs accept full, partial and release-only reruns; foreign/missing/expired/ambiguous metadata fails closed.",
);

const release = await readFile(".github/workflows/release.yml", "utf8");
assert.match(release, /group: production-release\n  cancel-in-progress: false/);
assert.match(
  release,
  /name: Verify merged main\n    uses: \.\/\.github\/workflows\/ci\.yml/,
);
assert.match(
  release,
  /NODE_ARTIFACT_ID: \$\{\{ needs\.verify\.outputs\.node-artifact-id \}\}/,
);
assert.match(
  release,
  /WORKERS_ARTIFACT_ID: \$\{\{ needs\.verify\.outputs\.workers-artifact-id \}\}/,
);
assert.match(
  release,
  /artifact-ids: \$\{\{ steps\.verified-artifacts\.outputs\.artifact-ids \}\}/,
);
assert.match(release, /merge-multiple: true/);
assert(
  release.indexOf("node scripts/verify-ci-artifacts.mjs") <
    release.indexOf("uses: actions/download-artifact"),
);
assert.doesNotMatch(
  release,
  /name: workers?\-|run: npm run build|continue-on-error/,
);
assert.match(release, /contents: write\n      actions: read/);
for (const [source, group, files] of [
  [node, "node", ["riparim-node.tar.gz", "node-provenance.json"]],
  [
    workers,
    "workers",
    [
      "riparim-worker.tar.gz",
      "provenance.json",
      "riparim-sites.tar.gz",
      "sites-provenance.json",
    ],
  ],
]) {
  assert(
    source.includes(
      `name: ${group}-${"${{ github.sha }}"}-${"${{ github.run_attempt }}"}`,
    ),
  );
  const paths = [...source.matchAll(/^            artifacts\/([^\n]+)$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(paths, files);
  for (const value of [
    "if-no-files-found: error",
    "retention-days: 14",
    "compression-level: 0",
    "id: build-artifact",
    "artifact-id: ${{ steps.build-artifact.outputs.artifact-id }}",
  ])
    assert(source.includes(value));
  assert.doesNotMatch(source, /overwrite:|node_modules/);
  assert(ci.includes(`value: ${"${{ jobs."}${group}.outputs.artifact-id }}`));
}
for (const source of [ci, release]) {
  for (const match of source.matchAll(/uses: (actions\/[a-z-]+)@([^\s]+)/g))
    assert.match(match[2], /^[0-9a-f]{40}$/);
  for (const match of source.matchAll(
    /- name: Install locked[^\n]*\n([\s\S]*?)(?=      - name:|$)/g,
  ))
    assert.match(match[1], /HUSKY: "0"/);
}
const policy = JSON.parse(
  await readFile(".github/repository-policy.json", "utf8"),
);
assert(JSON.stringify(policy).includes("Tests, types, lint and build"));
assert(
  (await readFile("scripts/deploy-node.mjs", "utf8")).includes(
    '"Verify merged main / Tests, types, lint and build"',
  ),
);
console.log(
  "Release receives only immutable target-specific IDs and retains six assets, SHA pins, required check names and production serialization.",
);
