import { DurableObject } from "cloudflare:workers";
import type { BackupMonitorEnv } from "./worker-env";
import {
  MONITOR_REPOSITORY,
  createGitHubReader,
  createHeartbeat,
  createResendNotifier,
  runBackupMonitor,
} from "../scripts/lib/backup-monitor-core.mjs";
import {
  decodeMonitorState,
  encodeMonitorState,
  MAX_MONITOR_STATE_BYTES,
} from "../scripts/lib/backup-monitor-state.mjs";

const schedule = "*/15 * * * *";
type MonitorResult = {
  status?: string;
  monitorHealthy: boolean;
  backupsHealthy: boolean;
  jobs: Array<{
    job: string;
    status: string;
    lastSuccessAt: string | null;
    url: string;
  }>;
};
function transferToken(env: BackupMonitorEnv) {
  const value = env.BACKUP_MONITOR_TRANSFER_TOKEN;
  return typeof value === "string" && /^[^\s]{32,256}$/.test(value)
    ? value
    : null;
}
function active(env: BackupMonitorEnv) {
  return (
    env.BACKUP_MONITOR_ENABLED === "true" &&
    env.BACKUP_MONITOR_PAUSED === "false" &&
    env.BACKUP_MONITOR_SCHEDULE === schedule
  );
}
function transports(env: BackupMonitorEnv, outbound: typeof fetch) {
  return {
    notifier: createResendNotifier({
      fetch: outbound,
      apiKey: env.BACKUP_MONITOR_RESEND_API_KEY,
      from: env.BACKUP_MONITOR_EMAIL_FROM,
      to: env.BACKUP_MONITOR_EMAIL_TO,
    }),
    heartbeat: createHeartbeat({
      fetch: outbound,
      url: env.BACKUP_MONITOR_HEARTBEAT_URL,
    }),
  };
}
function configured(env: BackupMonitorEnv) {
  if (!active(env) || !transferToken(env)) return false;
  try {
    transports(env, fetch);
    return true;
  } catch {
    return false;
  }
}
const inactive = () => ({
  status: "inactive",
  monitorHealthy: false,
  backupsHealthy: false,
  jobs: [],
});

export class BackupMonitor extends DurableObject<BackupMonitorEnv> {
  private queue: Promise<void> = Promise.resolve();
  private queued = 0;
  private checking: Promise<MonitorResult> | undefined;

  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    if (this.queued >= 2) throw Error("Monitor operation queue is full.");
    this.queued++;
    const next = this.queue.then(operation);
    this.queue = next.then(
      () => {},
      () => {},
    );
    try {
      return await next;
    } finally {
      this.queued--;
    }
  }

  private paused() {
    if (
      this.env.BACKUP_MONITOR_PAUSED !== "true" ||
      this.env.BACKUP_MONITOR_ENABLED === "true"
    )
      throw Error("Pause monitoring before state transfer.");
  }

  async exportState(): Promise<string> {
    this.paused();
    return this.serial(async () => {
      const text = await this.ctx.storage.get<string>("monitor-state");
      return encodeMonitorState(
        text === undefined ? { version: 1, jobs: {} } : JSON.parse(text),
      );
    });
  }

  async importState(text: string, replace = false): Promise<boolean> {
    this.paused();
    return this.serial(async () => {
      const state = decodeMonitorState(text);
      if (
        !replace &&
        (await this.ctx.storage.get("monitor-state")) !== undefined
      )
        return false;
      await this.ctx.storage.put("monitor-state", JSON.stringify(state));
      return true;
    });
  }

  async check(): Promise<MonitorResult> {
    if (!configured(this.env)) return inactive();
    if (this.checking) return this.checking;
    const checking = this.serial(async () => {
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 4 * 60 * 1000);
      let calls = 0;
      const outbound: typeof fetch = async (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        // Reserve one of 45 external requests for a failure heartbeat; Free permits 50.
        if (
          calls >= 45 ||
          (url.origin !== "https://hc-ping.com" && calls >= 44)
        )
          throw Error("Monitor external request budget exhausted.");
        calls++;
        return fetch(input, {
          ...init,
          signal:
            url.origin === "https://hc-ping.com"
              ? init?.signal
              : AbortSignal.any([
                  controller.signal,
                  ...(init?.signal ? [init.signal] : []),
                ]),
        });
      };
      const optionalToken =
        "BACKUP_MONITOR_GITHUB_TOKEN" in this.env &&
        typeof this.env.BACKUP_MONITOR_GITHUB_TOKEN === "string"
          ? this.env.BACKUP_MONITOR_GITHUB_TOKEN
          : undefined;
      try {
        return await runBackupMonitor({
          now: undefined,
          ...transports(this.env, outbound),
          readWorkflow: createGitHubReader({
            fetch: outbound,
            token: optionalToken,
          }),
          store: {
            load: async () => {
              const text = await this.ctx.storage.get<string>("monitor-state");
              if (text === undefined) return undefined;
              if (
                new TextEncoder().encode(text).byteLength >
                MAX_MONITOR_STATE_BYTES
              )
                throw Error("Monitor state is too large.");
              return JSON.parse(text);
            },
            save: async (value: unknown) => {
              encodeMonitorState(value);
              await this.ctx.storage.put(
                "monitor-state",
                JSON.stringify(value),
              );
            },
          },
        });
      } finally {
        clearTimeout(timeout);
      }
    });
    this.checking = checking;
    try {
      return await checking;
    } finally {
      if (this.checking === checking) this.checking = undefined;
    }
  }
}

async function authenticated(request: Request, env: BackupMonitorEnv) {
  const expected = transferToken(env);
  if (!expected) return false;
  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer [^\s]{32,256}$/.test(authorization))
    return false;
  const provided = authorization.slice(7);
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const subtle = crypto.subtle;
  return (
    "timingSafeEqual" in subtle &&
    typeof subtle.timingSafeEqual === "function" &&
    subtle.timingSafeEqual(left, right) === true
  );
}

async function boundedText(request: Request) {
  if (!request.body) throw Error("State transfer body required.");
  const reader = request.body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0,
    text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_MONITOR_STATE_BYTES)
        throw Error("State transfer exceeds its size limit.");
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
  }
}

export default {
  async fetch(request: Request, env: BackupMonitorEnv): Promise<Response> {
    if (!(await authenticated(request, env)))
      return Response.json({ status: "unauthorized" }, { status: 403 });
    const path = new URL(request.url).pathname;
    if (path === "/state" && ["GET", "PUT"].includes(request.method)) {
      if (
        env.BACKUP_MONITOR_PAUSED !== "true" ||
        env.BACKUP_MONITOR_ENABLED === "true"
      )
        return Response.json({ status: "pause_required" }, { status: 409 });
      const object = env.BACKUP_MONITOR.getByName(MONITOR_REPOSITORY);
      try {
        if (request.method === "GET")
          return new Response(await object.exportState(), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        const imported = await object.importState(
          await boundedText(request),
          request.headers.get("X-Monitor-Replace") === "true",
        );
        return Response.json(
          { status: imported ? "imported" : "already_initialized" },
          { status: imported ? 201 : 409 },
        );
      } catch {
        return Response.json({ status: "transfer_error" }, { status: 400 });
      }
    }
    if (path === "/run" && request.method === "POST") {
      if (!configured(env)) return Response.json(inactive());
      try {
        const result =
          await env.BACKUP_MONITOR.getByName(MONITOR_REPOSITORY).check();
        return Response.json(result, {
          status: result.monitorHealthy ? 200 : 503,
        });
      } catch {
        return Response.json(
          {
            status: "monitor_error",
            monitorHealthy: false,
            backupsHealthy: false,
          },
          { status: 503 },
        );
      }
    }
    return Response.json({ status: "not_found" }, { status: 404 });
  },
  async scheduled(
    controller: ScheduledController,
    env: BackupMonitorEnv,
    ctx: ExecutionContext,
  ) {
    if (!configured(env) || controller.cron !== schedule) return;
    ctx.waitUntil(
      env.BACKUP_MONITOR.getByName(MONITOR_REPOSITORY)
        .check()
        .then((result) => {
          console.log(
            JSON.stringify({
              monitorHealthy: result.monitorHealthy,
              backupsHealthy: result.backupsHealthy,
            }),
          );
          if (!result.monitorHealthy) throw Error("Backup monitor failed.");
        }),
    );
  },
} satisfies ExportedHandler<BackupMonitorEnv>;
