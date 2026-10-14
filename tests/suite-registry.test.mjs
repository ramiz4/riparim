import { readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { selectSuites } from "./helpers/suite-registry.mjs";

assert.deepEqual(
  selectSuites("node"),
  ["node-runtime.test.mjs", "node-release.test.mjs"],
  "node group runs exactly both integration suites",
);
const all = selectSuites(),
  core = selectSuites("core"),
  node = selectSuites("node");
assert.deepEqual(
  [...core, ...node].sort(),
  [...all].sort(),
  "groups cover default exactly once",
);
assert.equal(new Set(all).size, all.length);
assert(!core.some((suite) => node.includes(suite)), "groups are disjoint");
assert.throws(
  () => selectSuites("typo"),
  /Unknown test group/,
  "unknown groups cannot silently skip verification",
);
assert.throws(
  () =>
    selectSuites("core", [
      { file: "same.test.mjs", group: "core" },
      { file: "same.test.mjs", group: "node" },
    ]),
  /Duplicate suite/,
  "duplicate registration cannot run a suite twice",
);
assert.throws(
  () =>
    selectSuites("all", [{ file: "unknown.test.mjs", group: "unregistered" }]),
  /Invalid suite group/,
  "every suite belongs to an explicit execution group",
);

const buildSuites = new Set([
  "production-navigation.test.mjs",
  "public-assets.test.mjs",
  "i18n-worker.test.mjs",
  "public-release-worker.test.mjs",
  "workshop-not-found-worker.test.mjs",
  "private-read-worker.test.mjs",
]);
assert.deepEqual(
  [...all].sort(),
  (await readdir(new URL("./", import.meta.url)))
    .filter((file) => file.endsWith(".test.mjs") && !buildSuites.has(file))
    .sort(),
  "every non-build suite is registered exactly once",
);
console.log(
  "Suite registry: complete default, disjoint core/node, unknown and duplicate registration refusal passed",
);
