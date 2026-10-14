import { appendFileSync, realpathSync } from "node:fs";
import { isExpectedNextBuild } from "./ci-performance.mjs";
import { isMainThread } from "node:worker_threads";

// Benchmark-only pre-main observation: Next replaces process.title immediately,
// erasing its original Linux cmdline before an RSS sampler can see the launch.
const { BENCHMARK_NEXT_CLI: expected, BENCHMARK_NEXT_LAUNCH_LOG: log } =
  process.env;
if (
  isMainThread &&
  log &&
  (await isExpectedNextBuild(process.argv, process.cwd(), expected))
) {
  appendFileSync(
    log,
    JSON.stringify({
      pid: process.pid,
      timeOrigin: performance.timeOrigin,
      cli: realpathSync(process.argv[1]),
    }) + "\n",
  );
}
