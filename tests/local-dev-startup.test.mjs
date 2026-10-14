import assert from "node:assert/strict";
import { spawn, execFile, execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const root = process.cwd(),
  run = promisify(execFile);
await mkdir(join(root, ".test-runtime"), { recursive: true });
const temporary = await mkdtemp(join(root, ".test-runtime/local-dev-startup-"));
let server;

async function checkout(name) {
  const directory = join(temporary, name);
  await mkdir(directory);
  // Copy only source: dependencies are shared, while databases, secrets, build
  // output and execution-profile selections stay outside these fresh checkouts.
  for (const file of execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean)) {
    await mkdir(dirname(join(directory, file)), { recursive: true });
    await cp(join(root, file), join(directory, file));
  }
  await symlink(join(root, "node_modules"), join(directory, "node_modules"));
  return directory;
}

async function availablePort() {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

async function start(directory, options = {}) {
  const port = options.port ?? (await availablePort()),
    environment = {};
  let origin = port === 0 ? undefined : `http://127.0.0.1:${port}`;
  for (const key of ["PATH", "HOME", "TMPDIR", "SystemRoot"])
    if (process.env[key]) environment[key] = process.env[key];
  Object.assign(environment, {
    NODE_ENV: "development",
    CLOUDFLARE_CF_FETCH_ENABLED: "false",
    WRANGLER_SEND_METRICS: "false",
    NEXT_TELEMETRY_DISABLED: "1",
    NO_COLOR: "1",
  });
  let logs = "";
  server = spawn(
    process.execPath,
    [
      "scripts/run-framework.mjs",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: directory,
      env: environment,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => (logs += chunk));
  server.stderr.on("data", (chunk) => (logs += chunk));
  let spawnError;
  server.on("error", (error) => (spawnError = error));
  server.closed = new Promise((resolve) => server.once("close", resolve));
  const deadline = performance.now() + 60000;
  while (performance.now() < deadline) {
    assert.equal(spawnError, undefined, "The real dev entry point can spawn");
    assert.equal(
      server.exitCode,
      null,
      "Fresh local dev must prepare its schema before seeding and stay running:\n" +
        logs,
    );
    if (!origin) {
      const announced = /http:\/\/127\.0\.0\.1:(\d+)/.exec(logs);
      if (announced && Number(announced[1]) > 0)
        origin = `http://127.0.0.1:${announced[1]}`;
      else {
        await delay(100);
        continue;
      }
    }
    try {
      const response = await fetch(origin + "/api/workshops", {
        signal: AbortSignal.timeout(1000),
      });
      const output = await response.text();
      if (response.status === 200) return { origin, output, logs };
    } catch {}
    await delay(100);
  }
  assert.fail("Local dev did not serve its prepared catalogue:\n" + logs);
}

async function stop() {
  if (!server) return;
  const child = server;
  server = undefined;
  const signal = (value) => {
    try {
      process.kill(-child.pid, value);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  signal("SIGTERM");
  const timeout = setTimeout(() => signal("SIGKILL"), 5000);
  try {
    await child.closed;
  } finally {
    clearTimeout(timeout);
    signal("SIGKILL");
  }
}

try {
  const first = await checkout("first");
  const { origin, output } = await start(first);
  const catalogue = JSON.parse(output);
  assert(
    catalogue.workshops.some(
      (workshop) => workshop.id === "ahp-volkswagen-prizren",
    ),
    "A fresh dev server reads the default catalogue from its prepared D1 state",
  );
  const profile = await fetch(origin + "/en/workshop/ahp-volkswagen-prizren", {
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(profile.status, 200);
  assert.match(await profile.text(), /AHP Volkswagen/);
  await stop();
  // Edit only disposable state through the same local CLI a developer uses.
  // The newer revision must remain visible after preparation runs again.
  await run(
    process.execPath,
    [
      join(root, "node_modules/wrangler/bin/wrangler.js"),
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      ".sites-runtime/local-dev/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--command",
      "UPDATE workshops SET name='Isolated local profile',updated_at='2099-01-01T00:00:00Z' WHERE id='ahp-volkswagen-prizren'",
    ],
    {
      cwd: first,
      env: {
        ...process.env,
        CLOUDFLARE_CF_FETCH_ENABLED: "false",
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_WRITE_LOGS: "false",
      },
    },
  );
  const restarted = JSON.parse((await start(first)).output);
  assert.equal(
    restarted.workshops.find(
      (workshop) => workshop.id === "ahp-volkswagen-prizren",
    ).name,
    "Isolated local profile",
    "Restart preserves newer local edits and uses the same prepared state",
  );
  await stop();
  const second = await checkout("second");
  const ephemeral = await start(second, { port: 0 });
  assert.notEqual(
    new URL(ephemeral.origin).port,
    "0",
    "An ephemeral CLI port resolves to a usable announced address",
  );
  const independent = JSON.parse(ephemeral.output);
  assert.equal(
    independent.workshops.find(
      (workshop) => workshop.id === "ahp-volkswagen-prizren",
    ).name,
    "AHP Volkswagen / Audi / Skoda",
    "Separate checkouts use independent local state",
  );
  await stop();
  console.log(
    "Local dev startup: fresh HTTP catalogue/profile, repeated start, preserved edits and checkout isolation passed",
  );
} finally {
  await stop();
  await rm(temporary, { recursive: true, force: true });
}
