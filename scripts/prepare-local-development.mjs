import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runLocalD1 } from "./local-d1.mjs";
import {
  localErrorCause,
  redactLocalDiagnostic,
} from "./local-diagnostics.mjs";
import {
  checkoutRoot,
  localDevelopmentConfiguration,
} from "./local-development.mjs";

function preparationError(local, phase, cause) {
  return new Error(
    redactLocalDiagnostic(
      `Local development ${phase} failed: ${cause}\n` +
        `Database: DB (local only)\nConfig: ${local.configPath}\nState: ${local.persistPath}\n` +
        `Next: follow docs/local-development.md, then run npm run dev:setup.`,
    ),
  );
}

async function checkLocalHistory(local, options) {
  const { loadMigrationSet, normalizedSql } =
    await import("./data-transfer.mjs");
  const migrations = await loadMigrationSet(local.root);
  const files = (await readdir(resolve(local.root, "drizzle")))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  if (
    JSON.stringify(files) !== JSON.stringify(migrations.map(({ name }) => name))
  )
    throw preparationError(
      local,
      "inspection",
      "Migration files do not match the checked-in journal.",
    );
  const query = async (sql) => {
    const output = await runLocalD1(
      local,
      "inspection",
      ["execute", "DB", "--json", "--command", sql],
      options,
    );
    return JSON.parse(output)[0].results;
  };
  const schema = await query(
    "SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name",
  );
  const applicationSchema = (items) =>
    items
      .filter(
        ({ name, type }) =>
          !(
            type === "table" &&
            [
              "d1_migrations",
              "sqlite_sequence",
              "_cf_KV",
              "_cf_METADATA",
            ].includes(name)
          ),
      )
      .map(({ name, type, tbl_name, sql }) => ({
        name,
        type,
        table: tbl_name,
        sql: normalizedSql(sql),
      }));
  const historyTable = schema.find(
    ({ name, type }) => name === "d1_migrations" && type === "table",
  );
  if (!historyTable && applicationSchema(schema).length)
    throw preparationError(
      local,
      "inspection",
      "Existing local application tables, but migration history is missing. Automatic replay is unsafe.",
    );
  let history = [];
  if (historyTable) {
    const expectedHistory =
      "CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)";
    if (normalizedSql(historyTable.sql) !== normalizedSql(expectedHistory))
      throw preparationError(
        local,
        "inspection",
        "Native migration history has an unknown table definition.",
      );
    history = await query(
      "SELECT id,name,applied_at FROM d1_migrations ORDER BY id",
    );
    if (
      history.length > migrations.length ||
      history.some(
        (row, index) =>
          !Number.isSafeInteger(row.id) ||
          row.id < 1 ||
          (index > 0 && row.id <= history[index - 1].id) ||
          row.name !== migrations[index].name ||
          typeof row.applied_at !== "string" ||
          !Number.isFinite(Date.parse(row.applied_at)),
      )
    )
      throw preparationError(
        local,
        "inspection",
        "Migration history is not a valid checked-in prefix. Automatic replay is unsafe.",
      );
  }
  const { DatabaseSync } = await import("node:sqlite");
  const expected = new DatabaseSync(":memory:");
  try {
    for (const migration of migrations.slice(0, history.length))
      expected.exec(migration.sql);
    const expectedSchema = expected
      .prepare(
        "SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name",
      )
      .all();
    if (
      JSON.stringify(applicationSchema(schema)) !==
      JSON.stringify(applicationSchema(expectedSchema))
    )
      throw preparationError(
        local,
        "inspection",
        "Local schema does not match its recorded migration history. Automatic replay is unsafe.",
      );
  } finally {
    expected.close();
  }
}

async function checkPrerequisites(local) {
  let engines;
  try {
    ({ engines } = JSON.parse(
      await readFile(resolve(local.root, "package.json"), "utf8"),
    ));
    if (typeof engines?.node !== "string")
      throw new Error("Missing Node.js engine contract");
  } catch (error) {
    throw preparationError(
      local,
      "prerequisites",
      `Cannot read the package.json Node.js engine contract (${error.code ?? error.name}). Restore the tracked package file.`,
    );
  }
  const current = process.versions.node.split(".").map(Number);
  const supported = engines.node.split(" || ").some((range) => {
    const match = /^(\^|>=)(\d+)\.(\d+)\.(\d+)$/.exec(range);
    if (!match) return false;
    const minimum = match.slice(2).map(Number);
    if (match[1] === "^" && current[0] !== minimum[0]) return false;
    for (let index = 0; index < minimum.length; index++) {
      if (current[index] !== minimum[index])
        return current[index] > minimum[index];
    }
    return true;
  });
  if (!supported)
    throw preparationError(
      local,
      "prerequisites",
      `Unsupported Node.js ${process.versions.node}; package.json requires ${engines.node}. Use the documented Node.js LTS version.`,
    );
  for (const [name, path] of [
    ["Wrangler", "node_modules/wrangler/bin/wrangler.js"],
    ["Vinext", "node_modules/vinext/dist/cli.js"],
    ["esbuild", "node_modules/esbuild/package.json"],
    ["Zod", "node_modules/zod/package.json"],
    [
      "Cloudflare Vite plugin",
      "node_modules/@cloudflare/vite-plugin/package.json",
    ],
  ]) {
    try {
      await access(resolve(local.root, path), constants.R_OK);
    } catch (error) {
      throw preparationError(
        local,
        "prerequisites",
        `Installed ${name} is unavailable (${error.code}). Run npm run install:ci in this checkout first.`,
      );
    }
  }
}

export async function prepareLocalDevelopment(
  root = checkoutRoot,
  options = {},
) {
  const local = await localDevelopmentConfiguration(root);
  const lockPath = resolve(local.persistPath, ".riparim-prepare.lock");
  let locked = false,
    phase = "prerequisites";
  try {
    await checkPrerequisites(local);
    options.signal?.throwIfAborted();
    await mkdir(local.runtimePath, { recursive: true });
    await mkdir(local.persistPath, { recursive: true });
    await access(local.runtimePath, constants.W_OK);
    await access(local.persistPath, constants.W_OK);
    phase = "lock";
    try {
      await mkdir(lockPath);
    } catch (error) {
      if (error.code === "EEXIST")
        throw preparationError(
          local,
          phase,
          `State is busy: preparation lock ${lockPath}. Wait for the active setup. Never remove a live lock; recovery instructions explain how to verify a stale lock.`,
        );
      throw error;
    }
    locked = true;
    await writeFile(
      resolve(lockPath, "owner.json"),
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    await writeFile(local.configPath, JSON.stringify(local.wranglerConfig));
    phase = "inspection";
    console.log(
      "Local development: checking schema and migration history (local only).",
    );
    await checkLocalHistory(local, options);
    options.signal?.throwIfAborted();
    phase = "migrations";
    console.log("Local development: applying pending migrations (local only).");
    await runLocalD1(local, phase, ["migrations", "apply", "DB"], options);
    options.signal?.throwIfAborted();
    phase = "seed";
    console.log(
      "Local development: preparing catalogue and default opening hours.",
    );
    const { seedLocalOpeningHours } =
      await import("./seed-local-opening-hours.mjs");
    await seedLocalOpeningHours(local.root, options);
    options.signal?.throwIfAborted();
  } catch (error) {
    const failure = error.message.startsWith("Local development ")
      ? error
      : preparationError(
          local,
          phase,
          options.signal?.aborted
            ? "Preparation interrupted; the local migration journal will resume safely on retry."
            : localErrorCause(error),
        );
    failure.message = redactLocalDiagnostic(failure.message);
    if (!failure.message.includes("\nLog: ")) {
      const log = resolve(local.runtimePath, `${phase}.log`);
      let written = false;
      try {
        await writeFile(log, `${failure.message}\n`);
        written = true;
      } catch {
        /* An unwritable/missing runtime directory is already the prerequisite failure. */
      }
      failure.message += `\nLog: ${log}${written ? "" : " (unavailable before writable local setup)"}`;
    }
    throw failure;
  } finally {
    if (locked) await rm(lockPath, { recursive: true });
  }
}

export async function runLocalDevelopmentPreparationCLI(root = checkoutRoot) {
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
    await prepareLocalDevelopment(root, { signal: controller.signal });
    return 0;
  } catch (error) {
    console.error(redactLocalDiagnostic(error.message));
    return interruption === "SIGINT"
      ? 130
      : interruption === "SIGTERM"
        ? 143
        : 1;
  } finally {
    process.off("SIGINT", onInt);
    process.off("SIGTERM", onTerm);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  process.exitCode = await runLocalDevelopmentPreparationCLI();
