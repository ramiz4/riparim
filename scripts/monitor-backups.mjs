import { constants } from "node:fs";
import { link, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import {
  createGitHubReader,
  createResendNotifier,
  createHeartbeat,
  runBackupMonitor,
} from "./lib/backup-monitor-core.mjs";
import {
  decodeMonitorState,
  encodeMonitorState,
} from "./lib/backup-monitor-state.mjs";
export * from "./lib/backup-monitor-core.mjs";
export * from "./lib/backup-monitor-state.mjs";

async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.mode & 0o077)
    throw Error("State directory must be private.");
}

export function createFileStore({ path }) {
  if (!isAbsolute(path)) throw Error("State path must be absolute.");
  return {
    async load() {
      let file;
      try {
        file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.mode & 0o077 || stat.size > 128 * 1024)
          throw Error("Invalid private state file.");
        return JSON.parse(await file.readFile("utf8"));
      } finally {
        await file.close();
      }
    },
    async save(value, { replace = true } = {}) {
      const directory = dirname(path);
      await privateDirectory(directory);
      const temporary = `${path}.${randomUUID()}.tmp`;
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(JSON.stringify(value) + "\n");
        await file.sync();
        await file.close();
        if (replace) await rename(temporary, path);
        else await link(temporary, path);
        const parent = await open(directory, "r");
        try {
          await parent.sync();
        } finally {
          await parent.close();
        }
      } finally {
        await file.close();
        await unlink(temporary).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    },
  };
}

export async function runMonitorCli({
  env = process.env,
  args = [],
  fetch = globalThis.fetch,
  output = (value) => console.log(JSON.stringify(value)),
} = {}) {
  if (
    !args.length &&
    (env.BACKUP_MONITOR_ENABLED !== "true" ||
      env.BACKUP_MONITOR_PAUSED === "true")
  ) {
    output({ status: "inactive" });
    return 0;
  }
  let lock, heartbeat;
  const statePath = env.BACKUP_MONITOR_STATE_PATH;
  try {
    if (args.length) {
      const [command, file, flag] = args;
      if (
        !["import-state", "export-state"].includes(command) ||
        args.length < 2 ||
        args.length > 3 ||
        (flag && flag !== "--replace") ||
        env.BACKUP_MONITOR_PAUSED !== "true" ||
        env.BACKUP_MONITOR_ENABLED === "true" ||
        resolve(statePath) === resolve(file)
      )
        throw Error("Invalid or active state transfer.");
      const store = createFileStore({ path: statePath }),
        transferFile = createFileStore({ path: file });
      await privateDirectory(dirname(statePath));
      lock = await open(statePath + ".lock", "wx", 0o600);
      if (command === "export-state") {
        const text = encodeMonitorState(
          (await store.load()) ?? { version: 1, jobs: {} },
        );
        await transferFile.save(JSON.parse(text), {
          replace: flag === "--replace",
        });
      } else {
        const state = decodeMonitorState(
          JSON.stringify(await transferFile.load()),
        );
        await store.save(state, { replace: flag === "--replace" });
      }
      output({ status: command === "export-state" ? "exported" : "imported" });
      return 0;
    }
    heartbeat = createHeartbeat({
      url: env.BACKUP_MONITOR_HEARTBEAT_URL,
      fetch,
    });
    const notifier = createResendNotifier({
      apiKey: env.BACKUP_MONITOR_RESEND_API_KEY,
      from: env.BACKUP_MONITOR_EMAIL_FROM,
      to: env.BACKUP_MONITOR_EMAIL_TO,
      fetch,
    });
    const store = createFileStore({ path: statePath });
    await privateDirectory(dirname(statePath));
    lock = await open(statePath + ".lock", "wx", 0o600);
    const result = await runBackupMonitor({
      store,
      notifier,
      heartbeat,
      readWorkflow: createGitHubReader({
        fetch,
        token: env.BACKUP_MONITOR_GITHUB_TOKEN,
      }),
    });
    output(result);
    return result.monitorHealthy ? 0 : 1;
  } catch {
    if (heartbeat) await heartbeat(false).catch(() => {});
    output({ status: "monitor_error", monitorHealthy: false });
    return 1;
  } finally {
    if (lock) {
      await lock.close();
      await unlink(statePath + ".lock");
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runMonitorCli({ args: process.argv.slice(2) });
}
