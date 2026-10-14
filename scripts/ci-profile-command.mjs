import { spawn } from "node:child_process";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { processTreeMemory } from "./ci-performance.mjs";

const [directory, label, command, ...args] = process.argv.slice(2);
if (!directory || !/^[a-z][a-z0-9-]*$/.test(label ?? "") || !command)
  throw Error(
    "Usage: ci-profile-command.mjs OUTPUT_DIRECTORY PHASE COMMAND ARG...",
  );
await mkdir(directory, { recursive: true });
const logPath = join(directory, `${label}.log`),
  log = createWriteStream(logPath),
  startedAt = new Date().toISOString(),
  start = performance.now();
const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
for (const [stream, output] of [
  [child.stdout, process.stdout],
  [child.stderr, process.stderr],
])
  stream.on("data", (chunk) => {
    log.write(chunk);
    output.write(chunk);
  });
let exited = false,
  peak = 0,
  samples = 0,
  measurementError = null;
const known = new Map();
const nextLaunches = new Set();
const npmCacheProcesses = new Map();
async function processes() {
  const entries = await readdir("/proc");
  const result = await Promise.all(
    entries
      .filter((name) => /^\d+$/.test(name))
      .map(async (name) => {
        try {
          const stat = await readFile(`/proc/${name}/stat`, "utf8"),
            fields = stat.slice(stat.lastIndexOf(")") + 2).split(" "),
            status = await readFile(`/proc/${name}/status`, "utf8"),
            commandLine = (
              await readFile(`/proc/${name}/cmdline`, "utf8")
            ).split("\0"),
            rss = status.match(/^VmRSS:\s+(\d+) kB$/m);
          return {
            pid: Number(name),
            parent: Number(fields[1]),
            startTicks: fields[19],
            rssBytes: rss ? Number(rss[1]) * 1024 : 0,
            commandLine,
          };
        } catch (error) {
          // Processes can exit between the directory listing and these two reads.
          if (error.code === "ENOENT" || error.code === "ESRCH") return null;
          throw error;
        }
      }),
  );
  return result.filter(Boolean);
}
const measuring = (async () => {
  if (process.platform !== "linux") {
    measurementError = "Process-tree RSS is supported only on Linux /proc.";
    return;
  }
  while (!exited) {
    try {
      const table = await processes();
      const descendants = new Set([child.pid]);
      // Retain a descendant that was reparented, while guarding PID reuse.
      for (const process of table)
        if (known.get(process.pid) === process.startTicks)
          descendants.add(process.pid);
      for (let changed = true; changed;) {
        changed = false;
        for (const process of table)
          if (
            descendants.has(process.parent) &&
            !descendants.has(process.pid)
          ) {
            descendants.add(process.pid);
            changed = true;
          }
      }
      for (const process of table)
        if (descendants.has(process.pid))
          known.set(process.pid, process.startTicks);
      const owned = table.filter((process) => descendants.has(process.pid));
      for (const process of owned)
        if (
          process.commandLine.some((argument) =>
            /(?:^|\/)next\/dist\/bin\/next$/.test(argument),
          ) &&
          process.commandLine.includes("build") &&
          process.commandLine.includes("--webpack")
        )
          nextLaunches.add(`${process.pid}:${process.startTicks}`);
      if (process.env.NPM_CONFIG_CACHE)
        for (const ownedProcess of owned) {
          if (
            !ownedProcess.commandLine.some((argument) =>
              /(?:^|\/)(?:npm|npx)-cli\.js$/.test(argument),
            )
          )
            continue;
          const identity = `${ownedProcess.pid}:${ownedProcess.startTicks}`;
          if (npmCacheProcesses.has(identity)) continue;
          const args = ownedProcess.commandLine,
            index = args.lastIndexOf("--cache"),
            inline = args.findLast((argument) =>
              argument.startsWith("--cache="),
            );
          let effectiveCache =
            index >= 0 ? args[index + 1] : inline?.slice("--cache=".length);
          const explicitlyPinned = Boolean(effectiveCache);
          if (!effectiveCache) {
            try {
              const env = (
                await readFile(`/proc/${ownedProcess.pid}/environ`, "utf8")
              ).split("\0");
              effectiveCache =
                env
                  .find((entry) => entry.startsWith("npm_config_cache="))
                  ?.slice("npm_config_cache=".length) ??
                env
                  .find((entry) => entry.startsWith("NPM_CONFIG_CACHE="))
                  ?.slice("NPM_CONFIG_CACHE=".length);
            } catch (error) {
              if (error.code === "ENOENT" || error.code === "ESRCH") continue;
              throw error;
            }
          }
          npmCacheProcesses.set(identity, {
            explicitlyPinned,
            cache: effectiveCache ?? null,
          });
          if (effectiveCache !== process.env.NPM_CONFIG_CACHE)
            throw Error(
              "Observed npm process does not use the isolated benchmark cache.",
            );
        }
      // Synthetic root links include reparented descendants in one aggregate.
      const memory = processTreeMemory(
        owned.map((process) => ({
          ...process,
          parent: process.pid === child.pid ? process.parent : child.pid,
        })),
        child.pid,
      );
      peak = Math.max(peak, memory);
      samples++;
    } catch (error) {
      measurementError = error.message;
      break;
    }
    await delay(100);
  }
})();
let spawnError = null;
const outcome = await new Promise((resolve) => {
  child.on("error", (error) => {
    spawnError = error.message;
    resolve({ code: 1, signal: null });
  });
  child.on("close", (code, signal) => resolve({ code: code ?? 1, signal }));
});
exited = true;
await measuring;
await new Promise((resolve) => log.end(resolve));
const text = await readFile(logPath, "utf8");
const metric = {
  phase: label,
  startedAt,
  completedAt: new Date().toISOString(),
  elapsedSeconds: (performance.now() - start) / 1000,
  ...outcome,
  spawnError,
  memory: {
    method: "sampled aggregate process-tree RSS",
    intervalMilliseconds: 100,
    peakBytes: measurementError ? null : peak,
    samples,
    error: measurementError,
  },
  nextProductionCompilations: nextLaunches.size,
  npmCacheProcesses: [...npmCacheProcesses.values()],
  nextBuildBannerCount: (
    text.match(/Creating an optimized production build/g) ?? []
  ).length,
  subphases: [...text.matchAll(/\[ci-phase\] (\{[^\n]+\})/g)].map((match) =>
    JSON.parse(match[1]),
  ),
  suites: [
    ...text.matchAll(
      /\[([^\]]+\.test\.mjs)\] Finished with exit (\d+) in (\d+)ms/g,
    ),
  ].map((match) => ({
    suite: match[1],
    exitCode: Number(match[2]),
    seconds: Number(match[3]) / 1000,
  })),
};
await appendFile(
  join(directory, "phases.jsonl"),
  JSON.stringify(metric) + "\n",
);
await writeFile(
  join(directory, "memory-method.txt"),
  "Aggregate resident memory across the command and observed descendants, sampled every 100 ms. Detached groups remain descendants. Reparented observed children are retained with PID/start-time identity. This is an observed RSS peak and can miss short spikes; shared pages may be counted in more than one process. It is not a single-process GNU-time peak or an exact container limit.\n",
);
process.exitCode = outcome.code;
