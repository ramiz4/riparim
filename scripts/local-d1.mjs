import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { redactLocalDiagnostic } from "./local-diagnostics.mjs";

function diagnosticSummary(value) {
  const text = redactLocalDiagnostic(value);
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) =>
        /\[ERROR\]|\berror\b|SQLITE_|EACCES|ENOENT|EPERM|denied|failed/i.test(
          line,
        ),
      )
      .filter(
        (line) =>
          !/^\s*(?:SELECT|INSERT|UPDATE|CREATE|ALTER|DROP|DELETE|VALUES|FROM|SET)\b/i.test(
            line,
          ),
      )
      .slice(0, 4)
      .map((line) => line.slice(0, 400))
      .join("\n") || "See the phase log for the process result."
  );
}

export async function runLocalD1(local, phase, args, { signal } = {}) {
  const output = await new Promise((accept) => {
    const child = spawn(
      process.execPath,
      [
        local.wranglerPath,
        "d1",
        ...args,
        "--local",
        "--config",
        local.configPath,
        "--persist-to",
        local.persistPath,
      ],
      {
        cwd: local.root,
        stdio: ["ignore", "pipe", "pipe"],
        signal,
        env: {
          ...process.env,
          CLOUDFLARE_CF_FETCH_ENABLED: "false",
          WRANGLER_SEND_METRICS: "false",
          WRANGLER_WRITE_LOGS: "false",
          WRANGLER_LOG_PATH: resolve(local.runtimePath, "wrangler/logs"),
          WRANGLER_REGISTRY_PATH: resolve(
            local.runtimePath,
            "wrangler/dev-registry",
          ),
          MINIFLARE_REGISTRY_PATH: resolve(
            local.runtimePath,
            "wrangler/registry",
          ),
        },
      },
    );
    let stdout = "",
      stderr = "",
      error;
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    // Abort's error event precedes close. Keep the preparation lock until the
    // Wrangler wrapper and its inherited pipes have finished shutting down.
    child.once("error", (cause) => {
      error = cause;
    });
    child.once("close", (code, childSignal) =>
      accept({ stdout, stderr, code, signal: childSignal, error }),
    );
  });
  const log = resolve(local.runtimePath, `${phase}.log`);
  const cause = signal?.aborted
    ? "Preparation interrupted; retry resumes from the native migration journal."
    : output.code === 0 && !output.error
      ? "Completed successfully."
      : diagnosticSummary(output.error?.message ?? output.stderr);
  await writeFile(
    log,
    `Phase: ${phase}\nExit: ${output.code}\nSignal: ${output.signal ?? "none"}\n${cause}\n`,
  );
  if (output.code !== 0 || output.error || signal?.aborted) {
    throw new Error(
      redactLocalDiagnostic(
        `Local development ${phase} failed (${output.error?.code ? "spawn " + output.error.code : "exit " + (output.code ?? output.signal)}).\n` +
          `Database: DB (local only)\nConfig: ${local.configPath}\nState: ${local.persistPath}\n` +
          `${cause}\nLog: ${log}\nNext: follow docs/local-development.md, then run npm run dev:setup.`,
      ),
    );
  }
  return output.stdout;
}
