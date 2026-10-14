import assert from "node:assert/strict";
import {
  chmod,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { prepareLocalDevelopment } from "../scripts/prepare-local-development.mjs";

const checkout = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
const root = resolve(checkout, ".test-runtime/local-dev-bootstrap/fresh");
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
for (const directory of ["scripts", "lib", "db", "data", "drizzle", ".openai"])
  await cp(resolve(checkout, directory), resolve(root, directory), {
    recursive: true,
  });
await symlink(resolve(checkout, "node_modules"), resolve(root, "node_modules"));
await cp(resolve(checkout, "package.json"), resolve(root, "package.json"));
const journalPath = resolve(root, "drizzle/meta/_journal.json");
const fixtureJournal = JSON.parse(await readFile(journalPath, "utf8"));
const futureIndex = fixtureJournal.entries.length;
const futureTag = `${String(futureIndex).padStart(4, "0")}_fixture_future`;
fixtureJournal.entries.push({
  ...fixtureJournal.entries.at(-1),
  idx: futureIndex,
  tag: futureTag,
  when: fixtureJournal.entries.at(-1).when + 1,
});
await writeFile(journalPath, JSON.stringify(fixtureJournal));
await writeFile(
  resolve(root, "drizzle", `${futureTag}.sql`),
  "CREATE TABLE fixture_future(id TEXT PRIMARY KEY);",
);
const initialMigrationCount = fixtureJournal.entries.length;

try {
  const launcher = resolve(root, "scripts/run-framework.mjs");
  for (const flags of [["--port", "0"], ["-p", "0"], ["--port=0"]]) {
    const result = await execute(
      process.execPath,
      [launcher, "dev", ...flags, "--help"],
      { cwd: root },
    );
    assert.match(
      result.stdout,
      /vinext dev/,
      "The launcher preserves ephemeral port syntax supported by Vinext",
    );
  }
  await prepareLocalDevelopment(root);
  const files = await readdir(resolve(root, ".wrangler/state"), {
    recursive: true,
  });
  const filename = files.find((name) => name.endsWith(".sqlite"));
  assert(filename, "Setup creates the checkout's local database without dist");
  const db = new DatabaseSync(resolve(root, ".wrangler/state", filename));
  try {
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM d1_migrations").get().n,
      initialMigrationCount,
      "Setup records every checked-in migration in the native journal",
    );
    assert(
      db
        .prepare("SELECT count(*) AS n FROM workshops WHERE status='published'")
        .get().n > 0,
      "Setup prepares the real catalogue",
    );
    assert(
      db
        .prepare("SELECT count(*) AS n FROM workshop_opening_hours_imports")
        .get().n > 0,
      "The hours seed runs after its table is migrated",
    );
    db.exec(`INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,created_at)
      VALUES('fixture-visit','fixture-account','ahp-volkswagen-prizren','2026-10-14','fixture-car','service','invoice','2026-10-14');
      INSERT INTO evidence_uploads(file_key,owner) VALUES('fixture-proof','fixture-account');
      INSERT INTO workshop_owners(workshop_id,account_id,claim_id,confirmed_at,confirmed_by)
      VALUES('ahp-volkswagen-prizren','fixture-account','fixture-claim','2026-10-14','fixture-moderator');
      UPDATE workshops SET name='Local fixture edit',updated_at='2099-01-01T00:00:00Z' WHERE id='ahp-volkswagen-prizren';
      UPDATE workshop_opening_hours_imports SET suppressed=1 WHERE workshop_id='ahp-volkswagen-prizren';
      CREATE TRIGGER unexpected_native_trigger AFTER INSERT ON d1_migrations BEGIN SELECT 1; END;`);
  } finally {
    db.close();
  }
  await assert.rejects(
    prepareLocalDevelopment(root),
    /schema does not match.*Automatic replay is unsafe/s,
    "An unexpected trigger on migration history is divergent schema",
  );
  const native = new DatabaseSync(resolve(root, ".wrangler/state", filename));
  try {
    native.exec("DROP TRIGGER unexpected_native_trigger");
  } finally {
    native.close();
  }
  await prepareLocalDevelopment(root);
  const preserved = new DatabaseSync(
    resolve(root, ".wrangler/state", filename),
  );
  try {
    assert.equal(
      preserved.prepare("SELECT count(*) AS n FROM d1_migrations").get().n,
      initialMigrationCount,
    );
    assert.equal(
      preserved
        .prepare("SELECT owner FROM visits WHERE id='fixture-visit'")
        .get().owner,
      "fixture-account",
    );
    assert.equal(
      preserved
        .prepare(
          "SELECT owner FROM evidence_uploads WHERE file_key='fixture-proof'",
        )
        .get().owner,
      "fixture-account",
    );
    assert.equal(
      preserved
        .prepare(
          "SELECT account_id FROM workshop_owners WHERE workshop_id='ahp-volkswagen-prizren'",
        )
        .get().account_id,
      "fixture-account",
    );
    assert.equal(
      preserved
        .prepare("SELECT name FROM workshops WHERE id='ahp-volkswagen-prizren'")
        .get().name,
      "Local fixture edit",
    );
    assert.equal(
      preserved
        .prepare(
          "SELECT suppressed FROM workshop_opening_hours_imports WHERE workshop_id='ahp-volkswagen-prizren'",
        )
        .get().suppressed,
      1,
    );
  } finally {
    preserved.close();
  }

  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.entries.push({
    ...journal.entries.at(-1),
    idx: journal.entries.length,
    tag: `${String(journal.entries.length).padStart(4, "0")}_bootstrap_probe`,
    when: journal.entries.at(-1).when + 1,
  });
  await writeFile(journalPath, JSON.stringify(journal));
  const pending = resolve(root, "drizzle", `${journal.entries.at(-1).tag}.sql`);
  await writeFile(
    pending,
    "CREATE TABLE bootstrap_probe(id TEXT PRIMARY KEY); SELECT * FROM missing_fixture_table;",
  );
  await assert.rejects(
    prepareLocalDevelopment(root),
    /migrations failed.*exit 1.*missing_fixture_table.*migrations\.log/s,
  );
  const failed = new DatabaseSync(resolve(root, ".wrangler/state", filename));
  try {
    assert.equal(
      failed.prepare("SELECT count(*) AS n FROM d1_migrations").get().n,
      initialMigrationCount,
      "A failed native migration leaves successful receipts intact",
    );
    assert.equal(
      failed
        .prepare(
          "SELECT count(*) AS n FROM sqlite_schema WHERE name='bootstrap_probe'",
        )
        .get().n,
      0,
      "Wrangler rolls back the failed migration",
    );
  } finally {
    failed.close();
  }
  await writeFile(
    pending,
    "CREATE TABLE bootstrap_probe(id TEXT PRIMARY KEY);",
  );
  await prepareLocalDevelopment(root);
  const upgraded = new DatabaseSync(resolve(root, ".wrangler/state", filename));
  try {
    assert.equal(
      upgraded.prepare("SELECT count(*) AS n FROM d1_migrations").get().n,
      initialMigrationCount + 1,
      "Retry applies only the repaired pending migration",
    );
  } finally {
    upgraded.close();
  }
  const concurrent = await Promise.allSettled([
    prepareLocalDevelopment(root),
    prepareLocalDevelopment(root),
  ]);
  assert.equal(
    concurrent.filter(({ status }) => status === "fulfilled").length,
    1,
    "Only one bootstrap can write the same state",
  );
  assert.match(
    concurrent.find(({ status }) => status === "rejected").reason.message,
    /busy.*preparation lock/s,
  );
  const cli = resolve(root, "scripts/prepare-local-development.mjs");
  const standalone = await execute(process.execPath, [cli], { cwd: checkout });
  assert.match(
    standalone.stdout,
    /catalogue and default opening hours prepared/,
    "The standalone setup CLI completes without a server or an unsettled top-level await",
  );
  const interrupted = await new Promise((accept, reject) => {
    const child = spawn(process.execPath, [cli], {
      cwd: checkout,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Setup did not reach its inspection phase"));
    }, 10000);
    child.stdout.on("data", (data) => {
      output += data;
      if (output.includes("checking schema")) child.kill("SIGTERM");
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      accept({ code, output });
    });
  });
  assert.equal(
    interrupted.code,
    143,
    "SIGTERM returns an interrupt failure, never success",
  );
  assert.match(interrupted.output, /interrupted.*retry|interrupted.*resume/s);
  await execute(process.execPath, [cli], { cwd: checkout });

  const hoursPath = resolve(root, "data/opening-hours-import.json");
  const originalHours = await readFile(hoursPath, "utf8");
  await writeFile(hoursPath, "not-json");
  await assert.rejects(
    prepareLocalDevelopment(root),
    /seed failed.*JSON/s,
    "A source validation error stops at seed and remains retryable",
  );
  await writeFile(hoursPath, originalHours);
  const sensitiveKey = "private-unknown-opening-hours-key";
  const secret = "fixture-environment-secret-value";
  const invalidHours = JSON.parse(originalHours);
  invalidHours.records[0].hours[sensitiveKey] = secret;
  invalidHours.records[0].hours[secret] = "untrusted-fixture-value";
  await writeFile(hoursPath, JSON.stringify(invalidHours));
  for (const entry of [
    cli,
    resolve(root, "scripts/seed-local-opening-hours.mjs"),
  ])
    await assert.rejects(
      execute(process.execPath, [entry], {
        cwd: checkout,
        env: { ...process.env, RIPARIM_TEST_SECRET: secret },
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /seed failed.*validation/s);
        assert(
          !error.stderr.includes(sensitiveKey),
          "CLI validation diagnostics exclude untrusted property names",
        );
        assert(
          !error.stderr.includes(secret),
          "CLI validation diagnostics redact environment secrets",
        );
        return true;
      },
    );
  const validationLog = await readFile(
    resolve(root, ".sites-runtime/local-dev/seed.log"),
    "utf8",
  );
  assert(!validationLog.includes(sensitiveKey));
  assert(!validationLog.includes(secret));
  await writeFile(hoursPath, originalHours);
  await prepareLocalDevelopment(root);

  const unknown = new DatabaseSync(resolve(root, ".wrangler/state", filename));
  try {
    unknown.exec("CREATE TABLE unexpected_local_schema(id TEXT)");
  } finally {
    unknown.close();
  }
  await assert.rejects(
    prepareLocalDevelopment(root),
    /schema does not match.*Automatic replay is unsafe/s,
  );
  const restoredSchema = new DatabaseSync(
    resolve(root, ".wrangler/state", filename),
  );
  try {
    restoredSchema.exec(
      "DROP TABLE unexpected_local_schema; UPDATE d1_migrations SET name='unexpected_history.sql' WHERE id=1",
    );
  } finally {
    restoredSchema.close();
  }
  await assert.rejects(
    prepareLocalDevelopment(root),
    /history is not a valid checked-in prefix/s,
  );
  const legacy = new DatabaseSync(resolve(root, ".wrangler/state", filename));
  try {
    legacy.exec("DROP TABLE d1_migrations");
  } finally {
    legacy.close();
  }
  await assert.rejects(
    prepareLocalDevelopment(root),
    /migration history is missing.*docs\/local-development\.md/s,
    "An existing application schema without history stops before replay",
  );
  const stopped = new DatabaseSync(resolve(root, ".wrangler/state", filename));
  try {
    assert.equal(
      stopped
        .prepare(
          "SELECT count(*) AS n FROM sqlite_schema WHERE name='d1_migrations'",
        )
        .get().n,
      0,
      "Legacy refusal never initializes a replacement migration history",
    );
    assert.equal(
      stopped.prepare("SELECT owner FROM visits WHERE id='fixture-visit'").get()
        .owner,
      "fixture-account",
      "Inspection never modifies private fixture records",
    );
  } finally {
    stopped.close();
  }

  const actualNode = process.execPath;
  Object.defineProperty(process, "execPath", {
    value: resolve(root, "missing-node-executable"),
    configurable: true,
  });
  try {
    await assert.rejects(
      prepareLocalDevelopment(root),
      /inspection failed.*spawn ENOENT.*inspection\.log/s,
    );
  } finally {
    Object.defineProperty(process, "execPath", {
      value: actualNode,
      configurable: true,
    });
  }

  const hostingPath = resolve(root, ".openai/hosting.json");
  const originalHosting = await readFile(hostingPath, "utf8");
  await writeFile(hostingPath, "private-fixture-config-payload");
  await assert.rejects(
    prepareLocalDevelopment(root),
    (error) =>
      /configuration failed.*SyntaxError.*hosting.json.*State:/s.test(
        error.message,
      ) && !error.message.includes("private-fixture-config-payload"),
  );
  await writeFile(hostingPath, originalHosting);
  const packagePath = resolve(root, "package.json");
  const originalPackage = await readFile(packagePath, "utf8");
  await writeFile(packagePath, "private-fixture-package-payload");
  await assert.rejects(
    prepareLocalDevelopment(root),
    (error) =>
      /prerequisites failed.*package.json.*SyntaxError/s.test(error.message) &&
      !error.message.includes("private-fixture-package-payload"),
  );
  await writeFile(packagePath, originalPackage);
  await rm(resolve(root, "node_modules"));
  await assert.rejects(
    prepareLocalDevelopment(root),
    /prerequisites failed.*Wrangler.*ENOENT.*npm run install:ci/s,
  );
  await symlink(
    resolve(checkout, "node_modules"),
    resolve(root, "node_modules"),
  );
  const versionPreload = resolve(root, "unsupported-node.mjs");
  await writeFile(
    versionPreload,
    'Object.defineProperty(process.versions,"node",{value:"20.0.0"});',
  );
  await assert.rejects(
    execute(process.execPath, ["--import", versionPreload, cli]),
    (error) =>
      error.code === 1 &&
      /Unsupported Node.js 20\.0\.0.*package.json requires/s.test(error.stderr),
  );
  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    const runtime = resolve(root, ".sites-runtime/local-dev");
    await chmod(runtime, 0o555);
    try {
      await assert.rejects(
        prepareLocalDevelopment(root),
        /prerequisites failed.*EACCES/s,
      );
    } finally {
      await chmod(runtime, 0o755);
    }
  }
  console.log(
    "Local development bootstrap: native migrations, protected restart data, pending failure/retry, lock, CLI/abort, schema/history guards and prerequisite failures passed",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
