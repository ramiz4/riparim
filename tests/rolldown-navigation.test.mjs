import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rolldown } from "rolldown";
import { createVinextNavigationChunkGroup } from "../build/vinext-navigation.mjs";

const navigationId = "/fixture/node_modules/vinext/dist/shims/navigation.js";
const entryId = "/fixture/index.js";
const linkId = "/fixture/link.js";
const sources = new Map([
  [entryId, `
    import { getClientNavigationState } from ${JSON.stringify(navigationId)};
    globalThis.__riparimFixtureNavigationState = getClientNavigationState();
    globalThis.__riparimNavigationRegression = async () =>
      (await import(${JSON.stringify(linkId)})).checkNavigation();
  `],
  [navigationId, `
    export function getClientNavigationState() { return "fixture-state"; }
    export function getPrefetchInterceptionContext() { return "fixture-prefetch"; }
    export async function navigateClientSide() { return "fixture-navigation"; }
  `],
  [linkId, `
    let loadedNavigationModule = null;
    let navigationModulePromise = null;
    function loadNavigationModule() {
      return navigationModulePromise ??= import(${JSON.stringify(navigationId)}).then(module => {
        loadedNavigationModule = module;
        return module;
      });
    }
    export async function checkNavigation() {
      const { getPrefetchInterceptionContext, navigateClientSide } =
        loadedNavigationModule ?? await loadNavigationModule();
      return [getPrefetchInterceptionContext(), await navigateClientSide()];
    }
  `],
]);

async function buildFixture(groups, directory) {
  const bundle = await rolldown({
    input: { index: entryId },
    preserveEntrySignatures: false,
    plugins: [{
      name: "navigation-fixture",
      resolveId: id => sources.has(id) ? id : null,
      load: id => sources.get(id),
    }],
  });
  try {
    const result = await bundle.generate({
      format: "es",
      minify: true,
      // vinext sets this threshold; the navigation group must keep its own
      // smaller boundary instead of being absorbed into the browser entry.
      codeSplitting: {
        minSize: 10_000,
        groups: [{ name: "framework", test: /[\\/]node_modules[\\/]react[\\/]/ }, ...groups],
      },
    });
    await mkdir(directory, { recursive: true });
    await Promise.all(result.output.map(output => {
      assert.equal(output.type, "chunk");
      return writeFile(join(directory, output.fileName), output.code);
    }));
    await import(pathToFileURL(join(directory, "index.js")).href);
  } finally {
    await bundle.close();
  }
}

const runtime = fileURLToPath(new URL("../.test-runtime/", import.meta.url));
await mkdir(runtime, { recursive: true });
const fixtureDirectory = await mkdtemp(join(runtime, "rolldown-navigation-"));
try {
  // Match the actual vinext graph: the browser entry statically imports the
  // navigation module while a separate Link chunk dynamically caches it.
  await buildFixture([], join(fixtureDirectory, "baseline"));
  await assert.rejects(globalThis.__riparimNavigationRegression(), {
    name: "TypeError",
    message: /is not a function/,
  });

  await buildFixture([createVinextNavigationChunkGroup()], join(fixtureDirectory, "fixed"));
  assert.deepEqual(await globalThis.__riparimNavigationRegression(), ["fixture-prefetch", "fixture-navigation"]);
  assert.deepEqual(await globalThis.__riparimNavigationRegression(), ["fixture-prefetch", "fixture-navigation"]);
  console.log("Rolldown navigation regression passed: prefetch and cached navigation functions remain callable.");
} finally {
  delete globalThis.__riparimNavigationRegression;
  delete globalThis.__riparimFixtureNavigationState;
  await rm(fixtureDirectory, { recursive: true, force: true });
}
