import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const root = await json("package.json");
for (const [tool, names] of Object.entries({
  title: ["@commitlint/cli", "@commitlint/config-conventional"],
  release: ["semantic-release", "conventional-changelog-conventionalcommits"],
  deploy: ["wrangler", "esbuild"],
})) {
  const manifest = await json(`.github/tools/${tool}/package.json`),
    lock = await json(`.github/tools/${tool}/package-lock.json`);
  assert.equal(manifest.private, true);
  assert.deepEqual(
    manifest.dependencies,
    Object.fromEntries(names.map((name) => [name, root.devDependencies[name]])),
  );
  assert.equal(lock.lockfileVersion, 3);
  assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
  for (const name of names)
    assert.equal(
      lock.packages[`node_modules/${name}`].version,
      root.devDependencies[name],
    );
  assert.deepEqual(
    manifest.overrides ?? {},
    tool === "deploy" ? root.overrides : {},
  );
  for (const name of [
    "react",
    "react-dom",
    "next",
    "vinext",
    "vite",
    "drizzle-orm",
  ])
    assert(
      !lock.packages[`node_modules/${name}`],
      `${tool} must not install app/build package ${name}`,
    );
}
console.log(
  "Tool dependency policy: exact root pins, complete locked job trees and no app/build dependencies passed.",
);
