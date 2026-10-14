import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createNpmCacheWrapper } from "../scripts/ci-benchmark-cache.mjs";
import { nodeSourceDigest } from "../scripts/node-release.mjs";
import {
  quantile,
  workflowMetrics,
  processTreeMemory,
  inputInventory,
  compareSamples,
  benchmarkArtifactPattern,
  assessCollectedSample,
} from "../scripts/ci-performance.mjs";

assert.equal(quantile([400, 100, 300, 200], 0.5), 250);
assert.equal(quantile([400, 100, 300, 200], 0.95), 400);
assert.throws(() => quantile([], 0.5), /sample/);
assert.throws(() => quantile([NaN], 0.5), /finite/);
const at = (seconds) => new Date(seconds * 1000).toISOString();
const job = (name, start, end, conclusion = "success") => ({
  name,
  started_at: at(start),
  completed_at: at(end),
  conclusion,
});
const parallel = workflowMetrics({ created_at: at(0), run_attempt: 1 }, [
  job("Prepare benchmark", 1, 2),
  job("Benchmark quality", 3, 63),
  job("Benchmark node", 13, 113),
  job("Benchmark workers", 5, 85),
  job("Benchmark verify", 118, 120),
  job("Skipped auxiliary job", 0, 0, "skipped"),
]);
assert.equal(parallel.initialWaitSeconds, 3);
assert.equal(parallel.activeCriticalPathSeconds, 102);
assert.equal(parallel.executionSpanSeconds, 117);
assert.equal(parallel.endToEndSeconds, 120);
assert.equal(parallel.runnerSeconds, 242);
assert.equal(parallel.interJobIdleSeconds, 5);
assert.equal(parallel.schedulerDelaySeconds, 15);
assert.equal(parallel.success, true);
const idle = workflowMetrics({ created_at: at(0), run_attempt: 1 }, [
  job("Benchmark first", 3, 10),
  job("Benchmark second", 15, 20, "failure"),
]);
assert.equal(idle.interJobIdleSeconds, 5);
assert.equal(idle.success, false);
assert.equal(
  workflowMetrics({ created_at: at(0) }, [
    job("Benchmark baseline", 3, 10),
    { name: "Benchmark verify", conclusion: "skipped" },
  ]).success,
  true,
);
assert.equal(
  workflowMetrics({ created_at: at(0) }, [
    job("Benchmark node", 3, 10),
    { name: "Benchmark verify", conclusion: "skipped" },
  ]).success,
  false,
);
assert.throws(
  () =>
    workflowMetrics({ created_at: at(0) }, [
      job("Benchmark node", 3, 10),
      job("Benchmark verify", 9, 12),
    ]),
  /Gate timestamps/,
);
assert.throws(
  () => workflowMetrics({ created_at: at(0) }, []),
  /benchmark jobs/,
);
assert.throws(
  () => workflowMetrics({ created_at: at(0) }, [job("Benchmark n", 5, 3)]),
  /timestamps/,
);
const processes = [
  { pid: 10, parent: 1, rssBytes: 100 },
  { pid: 11, parent: 10, rssBytes: 200 },
  { pid: 12, parent: 11, rssBytes: 300 },
  { pid: 20, parent: 1, rssBytes: 10000 },
];
assert.equal(processTreeMemory(processes, 10), 600);
assert.equal(processTreeMemory(processes, 99), 0);
const inventoryFixture = {
  applicationDigest: "app",
  catalogueDigest: "catalogue",
  migrationDigest: "migration",
};
function sample(variant, cacheState, duration, id) {
  return {
    variant,
    cacheState,
    runId: id,
    runAttempt: 1,
    cacheHit: cacheState === "warm",
    nodeVersion: "v24.21.0",
    goVersion: "1.27.1",
    runnerImage: "ubuntu24",
    experiment: "fixture",
    inventory: inventoryFixture,
    metrics: {
      success: true,
      activeCriticalPathSeconds: duration,
      executionSpanSeconds: duration,
      endToEndSeconds: duration + 3,
      initialWaitSeconds: 3,
      runnerSeconds: 400,
      schedulerDelaySeconds: 0,
      interJobIdleSeconds: 0,
    },
  };
}
const samples = [];
for (const cacheState of ["cold", "warm"])
  for (let i = 0; i < (cacheState === "cold" ? 5 : 10); i++) {
    samples.push(sample("baseline", cacheState, 400, samples.length));
    samples.push(sample("candidate", cacheState, 200, samples.length));
  }
const report = compareSamples(samples);
assert.equal(report.complete, true);
assert.equal(report.comparisons[0].medianReduction, 0.5);
assert.equal(report.comparisons[0].efficiencyTargetMet, true);
assert.equal(compareSamples(samples.slice(2)).complete, false);
assert.throws(
  () => compareSamples([{ ...samples[0], cacheHit: true }]),
  /Cache-state/,
);
assert.throws(
  () =>
    compareSamples([samples[0], { ...samples[1], nodeVersion: "v24.10.0" }]),
  /environment/,
);
assert.throws(
  () =>
    compareSamples([
      samples[0],
      {
        ...samples[1],
        inventory: { ...inventoryFixture, migrationDigest: "other" },
      },
    ]),
  /migrationDigest/,
);
const failedSamples = [
  ...samples,
  {
    ...sample("candidate", "warm", 0, 99),
    metrics: { ...samples[0].metrics, success: false },
  },
];
assert.deepEqual(
  compareSamples(failedSamples).groups[3].failuresAndRetries,
  [99],
);
assert.throws(() => compareSamples([samples[0], samples[0]]), /Duplicate/);
assert.equal(
  benchmarkArtifactPattern({ id: 123, run_attempt: 2 }),
  "ci-performance-123-2-*",
);
const collectionRun = { id: 123, run_attempt: 1, created_at: at(0) },
  collectionJobs = [
    job("Benchmark baseline", 3, 10),
    { name: "Benchmark verify", conclusion: "skipped" },
  ],
  collectedLane = {
    ...sample("baseline", "cold", 7, 123),
    lane: "baseline",
    verified: true,
    inventory: { ...inventoryFixture, sourceDigest: "source" },
  };
assert.equal(
  assessCollectedSample(collectionRun, collectionJobs, [collectedLane]).sample
    .metrics.success,
  true,
);
assert.match(
  assessCollectedSample(collectionRun, collectionJobs, []).invalid.reason,
  /metadata/,
);
assert.match(
  assessCollectedSample({ ...collectionRun, run_attempt: 2 }, collectionJobs, [
    collectedLane,
  ]).invalid.reason,
  /Retry/,
);
assert.match(
  assessCollectedSample(collectionRun, collectionJobs, [
    collectedLane,
    collectedLane,
  ]).invalid.reason,
  /duplicate/,
);
assert.match(
  assessCollectedSample(collectionRun, collectionJobs, [
    { ...collectedLane, verified: false },
  ]).invalid.reason,
  /verification/,
);
assert.match(
  assessCollectedSample(
    collectionRun,
    [job("Benchmark baseline", 3, 10, "failure")],
    [collectedLane],
  ).invalid.reason,
  /failed/,
);

const root = await mkdtemp(join(tmpdir(), "riparim-ci-inputs-"));
try {
  const profileDirectory = join(root, "profile");
  const npmCli = join(root, "fake-npm.mjs"),
    isolatedCache = join(root, "cache");
  await writeFile(
    npmCli,
    "console.log(JSON.stringify({args:process.argv.slice(2),cache:process.env.npm_config_cache}));",
  );
  const wrapper = await createNpmCacheWrapper({
    directory: join(root, "bin"),
    cache: isolatedCache,
    cli: npmCli,
    log: join(root, "npm-cache.jsonl"),
  });
  // Mirror the actual deployment install's deliberately restricted environment.
  const cacheResult = JSON.parse(
    execFileSync(wrapper, ["ci", "--ignore-scripts"], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    }),
  );
  assert.deepEqual(cacheResult.args, [
    "--cache",
    isolatedCache,
    "ci",
    "--ignore-scripts",
  ]);
  assert.equal(cacheResult.cache, isolatedCache);
  const cacheLog = JSON.parse(
    (await readFile(join(root, "npm-cache.jsonl"), "utf8")).trim(),
  );
  assert.equal(cacheLog.inheritedCache, null);
  assert.equal(cacheLog.cache, isolatedCache);
  const localBin = join(root, "node_modules/.bin");
  await mkdir(localBin, { recursive: true });
  await writeFile(
    join(localBin, "npm"),
    `#!${process.execPath}\nconsole.log(JSON.stringify({cache:'default-HOME-cache'}));\n`,
    { mode: 0o700 },
  );
  const targetInstall = `const {execFileSync}=require('node:child_process');
    process.stdout.write(execFileSync('npm',['ci'],{env:{PATH:process.env.PATH,HOME:process.env.HOME}}));`;
  const lifecycleShadow = JSON.parse(
    execFileSync(process.execPath, ["-e", targetInstall], {
      env: {
        PATH: localBin + ":" + dirname(wrapper) + ":" + process.env.PATH,
        HOME: process.env.HOME,
      },
      encoding: "utf8",
    }),
  );
  assert.equal(lifecycleShadow.cache, "default-HOME-cache");
  const directSuite = JSON.parse(
    execFileSync(process.execPath, ["-e", targetInstall], {
      env: {
        PATH: dirname(wrapper) + ":" + localBin + ":" + process.env.PATH,
        HOME: process.env.HOME,
      },
      encoding: "utf8",
    }),
  );
  assert.equal(directSuite.cache, isolatedCache);
  const targetCli = join(root, "target-npm.mjs"),
    targetPackage = join(root, "target-package.json");
  await writeFile(
    targetCli,
    "console.log(JSON.stringify({target:true,cache:process.env.npm_config_cache}));",
  );
  await writeFile(targetPackage, JSON.stringify({ version: "11.21.0" }));
  const routedWrapper = await createNpmCacheWrapper({
    directory: join(root, "routed-bin"),
    cache: isolatedCache,
    cli: npmCli,
    targetCli,
    targetPackage,
    rootVersion: "11.12.0",
    log: join(root, "routed.jsonl"),
  });
  assert.equal(
    JSON.parse(
      execFileSync(routedWrapper, ["ci"], {
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: process.env.HOME },
      }),
    ).target,
    true,
  );
  assert.equal(
    JSON.parse(
      execFileSync(routedWrapper, ["ci"], {
        encoding: "utf8",
        env: { PATH: process.env.PATH, NPM_CONFIG_CACHE: isolatedCache },
      }),
    ).target,
    undefined,
  );
  const routed = (await readFile(join(root, "routed.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.deepEqual(
    routed.map((call) => call.version),
    ["11.21.0", "11.12.0"],
  );
  assert.throws(() =>
    execFileSync(wrapper, ["ci", "--cache=/wrong"], { stdio: "pipe" }),
  );
  await assert.rejects(
    createNpmCacheWrapper({
      directory: "relative",
      cache: isolatedCache,
      cli: npmCli,
      log: join(root, "bad"),
    }),
    /absolute/,
  );
  const fakeNext = join(root, "next/dist/bin/next");
  await mkdir(join(root, "next/dist/bin"), { recursive: true });
  await writeFile(fakeNext, "setTimeout(() => {}, 250);");
  const profiler = fileURLToPath(
    new URL("../scripts/ci-profile-command.mjs", import.meta.url),
  );
  execFileSync(
    process.execPath,
    [
      profiler,
      profileDirectory,
      "fixture",
      process.execPath,
      "-e",
      `
    console.log('[ci-phase] ' + JSON.stringify({phase:'fixture.http',durationMs:12}));
    console.log('[fixture.test.mjs] Finished with exit 0 in 23ms');
      const {spawnSync} = require('node:child_process');
      spawnSync(process.execPath, [${JSON.stringify(fakeNext)}, 'build', '--webpack'], {stdio:'pipe'});
      spawnSync(process.execPath, [${JSON.stringify(fakeNext)}, 'build', '--webpack'], {stdio:'pipe'});
  `,
    ],
    { stdio: "pipe" },
  );
  const measured = JSON.parse(
    (await readFile(join(profileDirectory, "phases.jsonl"), "utf8")).trim(),
  );
  assert.equal(measured.code, 0);
  assert.ok(measured.elapsedSeconds >= 0.2);
  assert.deepEqual(measured.subphases, [
    { phase: "fixture.http", durationMs: 12 },
  ]);
  assert.deepEqual(measured.suites, [
    { suite: "fixture.test.mjs", exitCode: 0, seconds: 0.023 },
  ]);
  if (process.platform === "linux") {
    assert.ok(measured.memory.peakBytes > 0);
    assert.ok(measured.memory.samples > 0);
    assert.equal(measured.memory.error, null);
    assert.equal(measured.nextProductionCompilations, 2);
    assert.equal(measured.nextBuildBannerCount, 0);
  } else {
    assert.equal(measured.memory.peakBytes, null);
    assert.match(measured.memory.error, /Linux/);
  }
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  for (const directory of ["app", "data", "drizzle", "scripts", ".github"])
    await mkdir(join(root, directory));
  for (const [file, content] of Object.entries({
    "app/page.tsx": "application",
    "data/catalog.json": "catalog",
    "drizzle/0001.sql": "migration",
    "scripts/test.mjs": "orchestration",
    ".github/ci.yml": "workflow",
    "package.json": JSON.stringify({
      scripts: { test: "old" },
      dependencies: { next: "1" },
    }),
    "package-lock.json": "lock",
    ".gitignore": "ignored-receipt-input.txt\n.generated/\n",
  }))
    await writeFile(join(root, file), content);
  execFileSync("git", ["add", "."], { cwd: root });
  const baseline = await inputInventory(root);
  assert.equal(
    baseline.sourceDigest,
    await nodeSourceDigest(root),
    "benchmark source identity matches the Node receipt contract",
  );
  await writeFile(
    join(root, "ignored-receipt-input.txt"),
    "untracked ignored output",
  );
  assert.equal(
    (await inputInventory(root)).sourceDigest,
    baseline.sourceDigest,
    "untracked ignored files do not become Node source inputs",
  );
  execFileSync("git", ["add", "--force", "ignored-receipt-input.txt"], {
    cwd: root,
  });
  const trackedIgnored = await inputInventory(root);
  assert.notEqual(
    trackedIgnored.sourceDigest,
    baseline.sourceDigest,
    "tracked files remain source inputs even when an ignore rule matches",
  );
  assert.equal(trackedIgnored.sourceDigest, await nodeSourceDigest(root));
  await writeFile(
    join(root, "ignored-receipt-input.txt"),
    "changed tracked receipt input",
  );
  const changedTrackedIgnored = await inputInventory(root);
  assert.notEqual(
    changedTrackedIgnored.sourceDigest,
    trackedIgnored.sourceDigest,
  );
  assert.equal(
    changedTrackedIgnored.sourceDigest,
    await nodeSourceDigest(root),
  );
  await writeFile(join(root, ".github/ci.yml"), "changed workflow");
  await writeFile(join(root, "scripts/test.mjs"), "changed test harness");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ scripts: { test: "new" }, dependencies: { next: "1" } }),
  );
  const candidate = await inputInventory(root);
  assert.equal(candidate.sourceDigest, await nodeSourceDigest(root));
  assert.notEqual(candidate.sourceDigest, baseline.sourceDigest);
  assert.equal(candidate.applicationDigest, baseline.applicationDigest);
  assert.equal(candidate.catalogueDigest, baseline.catalogueDigest);
  assert.equal(candidate.migrationDigest, baseline.migrationDigest);
  assert.deepEqual(candidate.applicationFiles, baseline.applicationFiles);
  await writeFile(join(root, "app/page.tsx"), "changed application");
  assert.notEqual(
    (await inputInventory(root)).applicationDigest,
    baseline.applicationDigest,
  );
  await writeFile(join(root, "drizzle/0001.sql"), "changed migration");
  assert.notEqual(
    (await inputInventory(root)).migrationDigest,
    baseline.migrationDigest,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("CI performance measurement contracts passed.");
