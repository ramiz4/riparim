import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
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
  const { runLocalDevelopmentPreparationCLI } =
    await import("./prepare-local-development.mjs");
  let port = String(defaultLocalDevPort);
  for (let index = 0; index < args.length; index++) {
    if (["--port", "-p"].includes(args[index])) port = args[index + 1];
    else if (args[index].startsWith("--port=")) port = args[index].slice(7);
  }
  if (!/^\d+$/.test(port ?? "") || Number(port) > 65535) {
    console.error(
      "Local development: --port must be an integer from 0 to 65535.",
    );
    process.exit(1);
  }
  if (Number(port) === 0) {
    // Select a concrete ephemeral loopback port before the Worker config is
    // created, so every local origin uses the port that Vinext will bind.
    const socket = createServer();
    await new Promise((accept, reject) => {
      socket.once("error", reject);
      socket.listen(0, "127.0.0.1", accept);
    });
    port = String(socket.address().port);
    await new Promise((accept, reject) =>
      socket.close((error) => (error ? reject(error) : accept())),
    );
    for (let index = 0; index < args.length; index++) {
      if (
        ["--port", "-p"].includes(args[index]) &&
        Number(args[index + 1]) === 0
      )
        args[index + 1] = port;
      else if (
        args[index].startsWith("--port=") &&
        Number(args[index].slice(7)) === 0
      )
        args[index] = `--port=${port}`;
    }
  }
  // Vinext loads .env after preparation. Leave SITE_ORIGIN available for its
  // existing overrides and pass only the selected local port to Vite.
  process.env.RIPARIM_LOCAL_DEV_PORT = port;
  const exitCode = await runLocalDevelopmentPreparationCLI();
  if (exitCode) process.exit(exitCode);
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
