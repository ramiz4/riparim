import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { availableParallelism, cpus, totalmem } from "node:os";
import {
  inputInventory,
  benchmarkCommandEnvironment,
} from "./ci-performance.mjs";
import { createNpmCacheWrapper } from "./ci-benchmark-cache.mjs";

const [lane, sourceDirectory, outputDirectory] = process.argv.slice(2);
if (
  !["baseline", "quality", "node", "workers"].includes(lane) ||
  !sourceDirectory ||
  !outputDirectory
)
  throw Error(
    "Expected baseline/quality/node/workers, source directory, output directory.",
  );
const source = resolve(sourceDirectory),
  output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
const cache = process.env.NPM_CONFIG_CACHE;
if (!cache || !cache.startsWith("/"))
  throw Error("An absolute isolated npm cache is required.");
const npmCli = realpathSync(
  execFileSync("sh", ["-c", "command -v npm"], { encoding: "utf8" }).trim(),
);
const wrappers = join(output, "bin");
const rootNpmVersion = execFileSync(process.execPath, [npmCli, "--version"], {
  encoding: "utf8",
}).trim();
await createNpmCacheWrapper({
  directory: wrappers,
  cache,
  cli: npmCli,
  rootVersion: rootNpmVersion,
  targetCli: join(source, "node_modules/npm/bin/npm-cli.js"),
  targetPackage: join(source, "node_modules/npm/package.json"),
  log: join(output, "npm-cache.jsonl"),
});
process.env.PATH = wrappers + ":" + process.env.PATH;
process.env.BENCHMARK_NEXT_CLI = join(
  source,
  "node_modules/next/dist/bin/next",
);
const inventory = await inputInventory(source);
const cacheState = process.env.BENCHMARK_CACHE_STATE;
if (process.env.BENCHMARK_CACHE_WAS_EMPTY !== "true")
  throw Error(
    "Sample requires proof of an initially empty dedicated cache directory.",
  );
if (!["cold", "warm", "prime"].includes(cacheState))
  throw Error("Invalid benchmark cache state.");
if (cacheState === "warm" && process.env.BENCHMARK_CACHE_HIT !== "true")
  throw Error("Warm sample requires an exact npm cache hit; prime it first.");
if (cacheState !== "warm" && process.env.BENCHMARK_CACHE_HIT === "true")
  throw Error("Cold/prime samples must not restore an npm cache.");
const metadata = {
  schema: 1,
  lane,
  variant: lane === "baseline" ? "baseline" : "candidate",
  cacheState,
  cacheHit: process.env.BENCHMARK_CACHE_HIT === "true",
  cacheDirectoryInitiallyEmpty: true,
  cacheKey: process.env.BENCHMARK_CACHE_KEY,
  experiment: process.env.BENCHMARK_EXPERIMENT,
  sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: source,
    encoding: "utf8",
  }).trim(),
  harnessRevision: process.env.GITHUB_SHA,
  nodeVersion: process.version,
  npmVersion: rootNpmVersion,
  goVersion: process.env.BENCHMARK_GO_VERSION,
  runnerImage: process.env.ImageOS ?? "unknown",
  runnerImageVersion: process.env.ImageVersion ?? "unknown",
  runnerArchitecture: process.arch,
  runnerResources: {
    availableParallelism: availableParallelism(),
    logicalCpus: cpus().length,
    cpuModels: [...new Set(cpus().map((cpu) => cpu.model))],
    totalMemoryBytes: totalmem(),
  },
  inventory,
};
await writeFile(
  join(output, "sample.json"),
  JSON.stringify(metadata, null, 2) + "\n",
);
const profiler = join(
  dirname(fileURLToPath(import.meta.url)),
  "ci-profile-command.mjs",
);
function run(phase, command, args = [], environment = {}) {
  const result = spawnSync(
    process.execPath,
    [profiler, output, phase, command, ...args],
    {
      cwd: source,
      stdio: "inherit",
      env: benchmarkCommandEnvironment(
        metadata.sourceRevision,
        process.env,
        environment,
      ),
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("install", "npm", ["run", "install:ci"], { HUSKY: "0" });
if (lane === "baseline" || lane === "quality") {
  run("format", "npm", ["run", "format:check"]);
  run("catalogue", "npm", ["run", "catalog:check"]);
  // npm test prepends node_modules/.bin (which contains npm itself), hiding the
  // cache wrapper before target installers sanitize their environment.
  run(
    "tests",
    process.execPath,
    lane === "baseline"
      ? ["tests/run.mjs"]
      : ["tests/run.mjs", "--group", "core"],
  );
  run("types", "npx", ["tsc", "--noEmit"]);
  run("lint", "npm", ["run", "lint"]);
  run("backup-worker", "npm", ["run", "backups:worker:check"]);
}
if (lane === "baseline" || lane === "node") {
  run("node-build", "npm", ["run", "build:node"]);
  if (lane === "node")
    run("node-tests", process.execPath, ["tests/run.mjs", "--group", "node"], {
      RIPARIM_NODE_PREBUILT: source,
    });
  run("node-package", "node", ["scripts/package-release.mjs", "node"]);
}
if (lane === "baseline" || lane === "workers") {
  run("cloudflare-build", "npm", ["run", "build"], {
    BUILD_TARGET: "cloudflare",
  });
  run("cloudflare-package", "npm", ["run", "release:package"]);
  run("sites-clean", "node", [
    "-e",
    'require("node:fs").rmSync("dist", {recursive:true,force:true})',
  ]);
  run("sites-build", "npm", ["run", "build"], { BUILD_TARGET: "sites" });
  run("sites-package", "node", ["scripts/package-release.mjs", "sites"]);
}
const phases = (await readFile(join(output, "phases.jsonl"), "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const compilations = phases.reduce(
    (total, phase) => total + phase.nextProductionCompilations,
    0,
  ),
  expected = lane === "baseline" ? 3 : lane === "node" ? 1 : 0;
if (compilations !== expected)
  throw Error(
    `Expected ${expected} Next production compilations; observed ${compilations}.`,
  );
if (phases.some((phase) => phase.memory.error || phase.memory.samples === 0))
  throw Error(
    "Process-tree resource measurement failed; this is not a valid sample.",
  );
if (lane === "baseline" || lane === "node") {
  const receipt = JSON.parse(
    await readFile(join(source, ".node-runtime/build.json"), "utf8"),
  );
  if (receipt.sourceDigest !== inventory.sourceDigest)
    throw Error(
      "Node build receipt does not match this sample's tracked source digest.",
    );
}
const npmBoundary = (await readFile(join(output, "npm-cache.jsonl"), "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
if (npmBoundary.some((call) => call.cache !== cache))
  throw Error("An npm boundary escaped the isolated cache.");
const confinedTargetInstalls = npmBoundary.filter(
  (call) => call.command === "ci" && call.inheritedCache === null,
).length;
if ((lane === "baseline" || lane === "node") && confinedTargetInstalls === 0)
  throw Error("No cache-isolated target npm install was observed.");
await writeFile(
  join(output, "sample.json"),
  JSON.stringify(
    {
      ...metadata,
      measuredNextProductionCompilations: compilations,
      npmBoundaryCalls: npmBoundary.length,
      confinedTargetInstalls,
      targetNpmVersion: JSON.parse(
        await readFile(join(source, "node_modules/npm/package.json"), "utf8"),
      ).version,
      verified: true,
    },
    null,
    2,
  ) + "\n",
);
