import { execFileSync, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  mkdtemp,
  realpath,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { nodeSourceDigest } from "./node-release.mjs";

// Medians use the midpoint; P95 uses nearest rank, as in the issue baseline.
export function quantile(values, percentile) {
  if (!values.length) throw Error("An empty sample has no quantile.");
  if (values.some((value) => !Number.isFinite(value)))
    throw Error("Samples must contain finite numbers.");
  if (!(percentile > 0 && percentile <= 1))
    throw Error("Percentile must be in (0, 1].");
  const sorted = [...values].sort((a, b) => a - b);
  if (percentile === 0.5 && sorted.length % 2 === 0)
    return (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return sorted[Math.ceil(sorted.length * percentile) - 1];
}

export function workflowMetrics(run, jobs) {
  const selected = jobs.filter((job) => job.name.startsWith("Benchmark "));
  const measured = selected.filter((job) => job.conclusion !== "skipped");
  if (!measured.length) throw Error("No benchmark jobs found.");
  const intervals = measured.map((job) => {
    const start = Date.parse(job.started_at) / 1000,
      end = Date.parse(job.completed_at) / 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      throw Error("Incomplete or invalid job timestamps.");
    return { start, end, duration: end - start };
  });
  const created = Date.parse(run.created_at) / 1000;
  if (!Number.isFinite(created)) throw Error("Invalid run timestamps.");
  intervals.sort((a, b) => a.start - b.start);
  const first = intervals[0].start,
    last = Math.max(...intervals.map((interval) => interval.end));
  let coveredUntil = first,
    idle = 0;
  for (const interval of intervals) {
    idle += Math.max(0, interval.start - coveredUntil);
    coveredUntil = Math.max(coveredUntil, interval.end);
  }
  const gate = measured.find((job) => job.name === "Benchmark verify");
  const gateInterval = gate
    ? {
        start: Date.parse(gate.started_at) / 1000,
        end: Date.parse(gate.completed_at) / 1000,
      }
    : null;
  const producerJobs = measured.filter((job) => job !== gate);
  const producerDurations = producerJobs.map(
    (job) => (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000,
  );
  if (
    gateInterval &&
    producerJobs.some(
      (job) => Date.parse(job.completed_at) / 1000 > gateInterval.start,
    )
  )
    throw Error("Gate timestamps precede a mandatory producer completion.");
  const criticalPath =
    Math.max(...producerDurations) +
    (gateInterval ? gateInterval.end - gateInterval.start : 0);
  return {
    initialWaitSeconds: first - created,
    // Producers start independently; the candidate gate follows every producer.
    activeCriticalPathSeconds: criticalPath,
    executionSpanSeconds: last - first,
    schedulerDelaySeconds: last - first - criticalPath,
    interJobIdleSeconds: idle,
    endToEndSeconds: last - created,
    runnerSeconds: intervals.reduce(
      (total, interval) => total + interval.duration,
      0,
    ),
    success: selected.every(
      (job) =>
        job.conclusion === "success" ||
        (job.name === "Benchmark verify" &&
          job.conclusion === "skipped" &&
          selected.some((other) => other.name === "Benchmark baseline")),
    ),
  };
}

export function processTreeMemory(processes, rootPid) {
  const descendants = new Set([rootPid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const process of processes)
      if (descendants.has(process.parent) && !descendants.has(process.pid)) {
        descendants.add(process.pid);
        changed = true;
      }
  }
  return processes.reduce(
    (total, process) =>
      total + (descendants.has(process.pid) ? process.rssBytes : 0),
    0,
  );
}
export async function isExpectedNextBuild(commandLine, cwd, expectedCLI) {
  if (
    !expectedCLI ||
    !commandLine.includes("build") ||
    !commandLine.includes("--webpack")
  )
    return false;
  const candidates = commandLine.filter((argument) =>
    /(?:^|\/)next\/dist\/bin\/next$/.test(argument),
  );
  if (!candidates.length) return false;
  try {
    const installed = await realpath(expectedCLI);
    for (const candidate of candidates)
      if ((await realpath(resolve(cwd, candidate))) === installed) return true;
    return false;
  } catch (error) {
    // Install phases precede node_modules, and observed processes may exit.
    if (error.code === "ENOENT" || error.code === "ESRCH") return false;
    throw error;
  }
}
export function benchmarkCommandEnvironment(
  sourceRevision,
  environment,
  overrides = {},
) {
  if (!/^[a-f0-9]{40}$/.test(sourceRevision))
    throw Error("Expected exact measured source commit.");
  return { ...environment, ...overrides, GITHUB_SHA: sourceRevision };
}

const applicationDirectories = new Set([
  "app",
  "assets",
  "components",
  "data",
  "db",
  "drizzle",
  "hooks",
  "lib",
  "public",
  "types",
  "vendor",
  "monitor",
]);
const applicationConfiguration = new Set([
  ".env.example",
  ".npmrc",
  "cloudflare-env.d.ts",
  "components.json",
  "drizzle.config.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "proxy.ts",
  "tsconfig.json",
  "vite.config.ts",
  "wrangler.jsonc",
  "wrangler.sites.jsonc",
  "wrangler.backup-monitor.jsonc",
]);
function digest(files) {
  const hash = createHash("sha256");
  for (const { path, sha256 } of files)
    hash.update(path + "\0" + sha256 + "\0");
  return hash.digest("hex");
}
export async function inputInventory(root = process.cwd()) {
  const paths = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .sort();
  const files = [],
    applicationFiles = [];
  for (const path of paths) {
    const content = await readFile(join(root, path));
    files.push({
      path,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
    if (
      !applicationDirectories.has(path.split("/")[0]) &&
      !applicationConfiguration.has(path)
    )
      continue;
    let applicationContent = content;
    if (path === "package.json") {
      const manifest = JSON.parse(content);
      delete manifest.scripts;
      applicationContent = JSON.stringify(manifest);
    }
    applicationFiles.push({
      path,
      sha256: createHash("sha256").update(applicationContent).digest("hex"),
    });
  }
  return {
    schema: 1,
    sourceDigest: await nodeSourceDigest(root),
    applicationDigest: digest(applicationFiles),
    catalogueDigest: digest(
      files.filter(
        ({ path }) => path.startsWith("data/") || path.startsWith("db/"),
      ),
    ),
    migrationDigest: digest(
      files.filter(({ path }) => path.startsWith("drizzle/")),
    ),
    applicationFiles,
    trackedFiles: files,
  };
}

export function compareSamples(samples) {
  const reference = samples.find((sample) => sample.cacheState !== "prime");
  if (!reference) throw Error("No measured samples.");
  const revisions = new Map(),
    runIds = new Set();
  for (const sample of samples) {
    if (sample.cacheState === "prime") continue;
    if (runIds.has(sample.runId)) throw Error("Duplicate benchmark run ID.");
    runIds.add(sample.runId);
    if (
      revisions.has(sample.variant) &&
      revisions.get(sample.variant) !== sample.sourceRevision
    )
      throw Error("Benchmark source revision differs within a variant.");
    revisions.set(sample.variant, sample.sourceRevision);
    if (
      sample.nodeVersion !== reference.nodeVersion ||
      sample.goVersion !== reference.goVersion ||
      sample.npmVersion !== reference.npmVersion ||
      sample.targetNpmVersion !== reference.targetNpmVersion ||
      sample.runnerArchitecture !== reference.runnerArchitecture ||
      sample.runnerImage !== reference.runnerImage ||
      sample.runnerResources?.availableParallelism !==
        reference.runnerResources?.availableParallelism ||
      sample.runnerResources?.logicalCpus !==
        reference.runnerResources?.logicalCpus ||
      sample.runnerResources?.totalMemoryBytes !==
        reference.runnerResources?.totalMemoryBytes ||
      sample.experiment !== reference.experiment ||
      sample.cacheKey !== reference.cacheKey
    )
      throw Error("Benchmark environment or experiment differs.");
    for (const field of [
      "applicationDigest",
      "catalogueDigest",
      "migrationDigest",
    ])
      if (sample.inventory[field] !== reference.inventory[field])
        throw Error(`Benchmark ${field} differs.`);
    if ((sample.cacheState === "warm") !== sample.cacheHit)
      throw Error("Cache-state provenance does not match the sample.");
  }
  const groups = [];
  for (const cacheState of ["cold", "warm"])
    for (const variant of ["baseline", "candidate"]) {
      const runs = samples.filter(
        (sample) =>
          sample.variant === variant && sample.cacheState === cacheState,
      );
      const successes = runs.filter(
        (sample) => sample.metrics.success && sample.runAttempt === 1,
      );
      const metrics = {};
      for (const field of [
        "activeCriticalPathSeconds",
        "executionSpanSeconds",
        "endToEndSeconds",
        "initialWaitSeconds",
        "runnerSeconds",
        "schedulerDelaySeconds",
        "interJobIdleSeconds",
      ])
        metrics[field] = successes.length
          ? {
              p50: quantile(
                successes.map((sample) => sample.metrics[field]),
                0.5,
              ),
              p95: quantile(
                successes.map((sample) => sample.metrics[field]),
                0.95,
              ),
            }
          : null;
      groups.push({
        cacheState,
        variant,
        samples: successes.length,
        requiredSamples: cacheState === "cold" ? 5 : 10,
        failuresAndRetries: runs
          .filter((sample) => !successes.includes(sample))
          .map((sample) => sample.runId),
        metrics,
      });
    }
  const comparisons = ["cold", "warm"].map((cacheState) => {
    const baseline = groups.find(
        (group) =>
          group.cacheState === cacheState && group.variant === "baseline",
      ),
      candidate = groups.find(
        (group) =>
          group.cacheState === cacheState && group.variant === "candidate",
      );
    const complete =
      baseline.samples >= baseline.requiredSamples &&
      candidate.samples >= candidate.requiredSamples;
    if (!baseline.samples || !candidate.samples)
      return { cacheState, complete };
    const reduction =
        1 -
        candidate.metrics.activeCriticalPathSeconds.p50 /
          baseline.metrics.activeCriticalPathSeconds.p50,
      runnerRatio =
        candidate.metrics.runnerSeconds.p50 /
        baseline.metrics.runnerSeconds.p50;
    return {
      cacheState,
      complete,
      medianReduction: reduction,
      runnerSecondsRatio: runnerRatio,
      latencyTargetMet:
        reduction >= 0.35 &&
        candidate.metrics.activeCriticalPathSeconds.p95 <
          baseline.metrics.activeCriticalPathSeconds.p95,
      efficiencyTargetMet: runnerRatio <= 1.25,
      warmOperatingBudgetMet:
        cacheState === "warm"
          ? candidate.metrics.activeCriticalPathSeconds.p50 <= 240 &&
            candidate.metrics.activeCriticalPathSeconds.p95 <= 300
          : null,
    };
  });
  return {
    schema: 1,
    groups,
    comparisons,
    complete: comparisons.every((comparison) => comparison.complete),
    runIds: samples.map((sample) => sample.runId),
    sourceRevisions: Object.fromEntries(revisions),
  };
}

const execute = promisify(execFile);
export function benchmarkArtifactPattern(run) {
  if (
    !Number.isSafeInteger(run.id) ||
    !Number.isSafeInteger(run.run_attempt) ||
    run.run_attempt < 1
  )
    throw Error("Invalid benchmark run/attempt identity.");
  return `ci-performance-${run.id}-${run.run_attempt}-*`;
}
export function assessCollectedSample(run, jobs, lanes) {
  const invalid = (reason) => ({
    invalid: {
      runId: run.id,
      runAttempt: run.run_attempt,
      conclusion: run.conclusion,
      reason,
      availableLanes: lanes.map((lane) => lane?.lane),
    },
  });
  if (run.run_attempt !== 1)
    return invalid(
      "Retry is not an independent first-attempt benchmark sample.",
    );
  if (!lanes.length)
    return invalid(
      "Missing sample metadata (setup/cache failure or unavailable artifacts).",
    );
  const first = lanes[0];
  if (
    lanes.some(
      (lane) =>
        !lane ||
        !["baseline", "candidate"].includes(lane.variant) ||
        !["cold", "warm", "prime"].includes(lane.cacheState) ||
        typeof lane.inventory?.sourceDigest !== "string",
    )
  )
    return invalid("Malformed sample metadata.");
  const required =
    first.variant === "candidate"
      ? ["quality", "node", "workers"]
      : ["baseline"];
  if (
    lanes.length !== required.length ||
    new Set(lanes.map((lane) => lane.lane)).size !== required.length ||
    required.some((name) => !lanes.some((lane) => lane.lane === name))
  )
    return invalid("Incomplete or duplicate lane metadata.");
  if (lanes.some((lane) => !lane.verified))
    return invalid("A lane did not finish benchmark verification.");
  for (const lane of lanes)
    if (
      lane.inventory.sourceDigest !== first.inventory.sourceDigest ||
      lane.sourceRevision !== first.sourceRevision ||
      lane.cacheState !== first.cacheState ||
      lane.variant !== first.variant ||
      lane.cacheHit !== first.cacheHit
    )
      return invalid("Mixed lane inputs or cache states.");
  const requiredJobs = required.map((name) => `Benchmark ${name}`);
  if (first.variant === "candidate") requiredJobs.push("Benchmark verify");
  if (
    requiredJobs.some(
      (name) =>
        !jobs.some((job) => job.name === name && job.conclusion === "success"),
    )
  )
    return invalid(
      "A mandatory benchmark job failed, was cancelled/skipped, or is incomplete.",
    );
  let metrics;
  try {
    metrics = workflowMetrics(run, jobs);
  } catch (error) {
    return invalid(error.message);
  }
  if (!metrics.success) return invalid("Benchmark verification jobs failed.");
  return {
    sample: {
      ...first,
      runId: run.id,
      runAttempt: run.run_attempt,
      metrics,
      lanes,
    },
  };
}
async function githubApi(endpoint) {
  const { stdout } = await execute("gh", ["api", endpoint], {
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}
async function jsonFilesBelow(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await jsonFilesBelow(path)));
    else if (entry.name === "sample.json") result.push(path);
  }
  return result;
}
async function main([command, ...args]) {
  if (command === "inventory" && args.length === 2) {
    await writeFile(
      args[1],
      JSON.stringify(await inputInventory(resolve(args[0])), null, 2) + "\n",
    );
  } else if (command === "report" && args.length === 2) {
    const samples = JSON.parse(await readFile(args[0], "utf8"));
    const report = compareSamples(samples);
    await writeFile(args[1], JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } else if (command === "collect" && args.length >= 3) {
    const [repository, outputDirectory, ...runIds] = args;
    if (
      !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
      runIds.some((id) => !/^\d+$/.test(id))
    )
      throw Error("Expected OWNER/REPO and numeric workflow run IDs.");
    await mkdir(outputDirectory, { recursive: true });
    const samples = [],
      invalidSamples = [];
    for (const runId of runIds) {
      const run = await githubApi(`repos/${repository}/actions/runs/${runId}`);
      const jobs = [];
      for (let page = 1; ; page++) {
        const response = await githubApi(
          `repos/${repository}/actions/runs/${runId}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`,
        );
        jobs.push(...response.jobs);
        if (response.jobs.length < 100) break;
      }
      const runDirectory = resolve(outputDirectory, runId);
      await mkdir(runDirectory, { recursive: true });
      const directory = await mkdtemp(
        join(runDirectory, `attempt-${run.run_attempt}-`),
      );
      await writeFile(
        join(directory, "run-and-jobs.json"),
        JSON.stringify({ run, jobs }, null, 2) + "\n",
      );
      let artifactError = null;
      try {
        await execute("gh", [
          "run",
          "download",
          runId,
          "--repo",
          repository,
          "--pattern",
          benchmarkArtifactPattern(run),
          "--dir",
          directory,
        ]);
      } catch (error) {
        artifactError = error.message;
      }
      const paths = await jsonFilesBelow(directory);
      let lanes = [];
      try {
        lanes = await Promise.all(
          paths.map(async (path) => JSON.parse(await readFile(path, "utf8"))),
        );
      } catch (error) {
        artifactError = error.message;
      }
      const assessed = assessCollectedSample(run, jobs, lanes);
      if (assessed.sample && !artifactError) samples.push(assessed.sample);
      else
        invalidSamples.push({
          ...(assessed.invalid ?? {
            runId: Number(runId),
            runAttempt: run.run_attempt,
            reason: "Artifact download/metadata failed.",
          }),
          artifactError,
          rawDirectory: directory,
        });
    }
    await writeFile(
      join(outputDirectory, "samples.json"),
      JSON.stringify(samples, null, 2) + "\n",
    );
    await writeFile(
      join(outputDirectory, "invalid-samples.json"),
      JSON.stringify(invalidSamples, null, 2) + "\n",
    );
    const report = {
      ...(samples.some((sample) => sample.cacheState !== "prime")
        ? compareSamples(samples)
        : {
            schema: 1,
            groups: [],
            comparisons: [],
            complete: false,
            runIds: samples.map((sample) => sample.runId),
          }),
      invalidSamples,
    };
    await writeFile(
      join(outputDirectory, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
  } else
    throw Error(
      "Usage: ci-performance.mjs inventory ROOT OUTPUT | collect OWNER/REPO DIRECTORY RUN_ID... | report SAMPLES_JSON OUTPUT_JSON",
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main(process.argv.slice(2));
