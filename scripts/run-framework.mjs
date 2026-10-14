import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";
import { defaultLocalDevPort } from "./local-development.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command))
  throw new Error("Expected dev or build.");
const managedLinux = readExecutionProfile() === "managed-linux";

if (managedLinux && command === "build") {
  const result = spawnSync(
    "bash",
    [fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (command === "dev" && !managedLinux) {
  const { prepareLocalDevelopment } =
    await import("./prepare-local-development.mjs");
  let port = String(defaultLocalDevPort);
  for (let index = 0; index < args.length; index++) {
    if (["--port", "-p"].includes(args[index])) port = args[index + 1];
    else if (args[index].startsWith("--port=")) port = args[index].slice(7);
  }
  if (!/^\d+$/.test(port ?? "") || Number(port) < 1 || Number(port) > 65535) {
    console.error(
      "Local development: --port must be an integer from 1 to 65535.",
    );
    process.exit(1);
  }
  // Vinext loads .env after preparation. Leave SITE_ORIGIN available for its
  // existing overrides and pass only the selected local port to Vite.
  process.env.RIPARIM_LOCAL_DEV_PORT = port;
  const controller = new AbortController();
  let interruption;
  const interrupt = (signal) => {
    interruption = signal;
    controller.abort();
  };
  const onInt = () => interrupt("SIGINT"),
    onTerm = () => interrupt("SIGTERM");
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);
  try {
    await prepareLocalDevelopment(undefined, { signal: controller.signal });
  } catch (error) {
    console.error(error.message);
    process.exitCode =
      interruption === "SIGINT" ? 130 : interruption === "SIGTERM" ? 143 : 1;
  } finally {
    process.off("SIGINT", onInt);
    process.off("SIGTERM", onTerm);
  }
  if (process.exitCode) process.exit(process.exitCode);
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(
  managedLinux
    ? "../node_modules/vite/bin/vite.js"
    : "../node_modules/vinext/dist/cli.js",
  import.meta.url,
);
process.argv = [
  process.execPath,
  fileURLToPath(cli),
  command,
  ...(!managedLinux && command === "dev"
    ? ["--port", String(defaultLocalDevPort)]
    : []),
  ...args,
];
await import(cli.href);
