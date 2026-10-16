import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  catalogueReleasePlan,
  statementSql,
} from "../scripts/catalogue-release-plan.mjs";
import { applyCatalogueRelease } from "../scripts/apply-catalogue-release.mjs";
const root = process.cwd(),
  directory = await mkdtemp(join(tmpdir(), "riparim-catalogue-release-"));
const commit = "a".repeat(40),
  catalogue = JSON.parse(await readFile("data/workshops.json", "utf8"));
const plan = await catalogueReleasePlan(catalogue, commit),
  planPath = join(directory, "plan.json");
const hours = JSON.parse(
  await readFile("data/opening-hours-import.json", "utf8"),
);
assert(
  plan.statements.every(
    (statement) => Buffer.byteLength(statementSql(statement)) < 100_000,
  ),
  "Every released statement stays below the D1 SQL-text limit, including hours JSON",
);
const { catalogueImportKey } = await import(
  pathToFileURL(join(root, ".sites-runtime/catalogue-release/import.mjs"))
);
const { contacts } = JSON.parse(
  await readFile("data/workshop-contacts.json", "utf8"),
);
const { contacts: emails } = JSON.parse(
  await readFile("data/workshop-emails.json", "utf8"),
);
assert.equal(
  plan.key,
  await catalogueImportKey(catalogue, contacts, emails, hours),
);
assert.notEqual(
  plan.key,
  await catalogueImportKey(catalogue, contacts, emails, {
    ...hours,
    revision: "f".repeat(64),
  }),
  "A schedule-only release cannot reuse the previous completion marker",
);
const sqlite = new DatabaseSync(":memory:");
let writes = 0,
  failAfter = Infinity;
const run = (_command, args) => {
  if (args.includes("--command"))
    return JSON.stringify([
      {
        success: true,
        results: sqlite.prepare(args[args.indexOf("--command") + 1]).all(),
      },
    ]);
  assert(args.includes("--remote") && args.includes("--yes"));
  if (writes++ === failAfter) throw Error("Interrupted D1 batch");
  sqlite.exec(readFileSync(args[args.indexOf("--file") + 1], "utf8"));
  return "";
};
const apply = async (name) => {
  const target = join(directory, name);
  mkdirSync(target);
  return applyCatalogueRelease({
    planPath,
    root,
    commit,
    cli: "fixture-wrangler",
    config: "fixture-config",
    directory: target,
    run,
    options: {},
  });
};
try {
  for (const file of (await readdir("drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    sqlite.exec(await readFile("drizzle/" + file, "utf8"));
  await writeFile(planPath, JSON.stringify(plan));
  failAfter = 1;
  await assert.rejects(apply("interrupted"), /Interrupted/);
  assert.equal(
    sqlite.prepare("SELECT value FROM catalog_state WHERE key=?").get(plan.key),
    undefined,
    "A partial import never has a completion marker",
  );
  failAfter = Infinity;
  await apply("resume");
  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS n FROM workshop_opening_hours_imports")
      .get().n,
    hours.records.length,
    "The exact released plan imports hours before Worker upload",
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM workshops WHERE opening_hours_confirmed_at IS NOT NULL",
      )
      .get().n,
    0,
    "Imported researched/default hours never invent owner confirmation",
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS n FROM workshops").get().n,
    catalogue.workshops.length,
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS n FROM workshop_contact_details").get()
      .n,
    10,
    "the release imports the researched contact source before worker upload",
  );
  const before = writes;
  assert.deepEqual(await apply("repeat"), {
    imported: false,
    reason: "complete",
  });
  assert.equal(
    writes,
    before,
    "Repeating a completed release performs no writes",
  );
  const id = catalogue.workshops[0].id;
  sqlite
    .prepare(
      "UPDATE workshops SET description='Newer admin revision',updated_at='2099-01-01T00:00:00Z' WHERE id=?",
    )
    .run(id);
  sqlite.prepare("DELETE FROM catalog_state WHERE key=?").run(plan.key);
  await apply("admin-preserved");
  assert.equal(
    sqlite.prepare("SELECT description FROM workshops WHERE id=?").get(id)
      .description,
    "Newer admin revision",
  );
  const tampered = {
    ...plan,
    statements: [
      ...plan.statements,
      { sql: "DROP TABLE workshops", params: [] },
    ],
  };
  await writeFile(planPath, JSON.stringify(tampered));
  await assert.rejects(apply("tampered"), /does not match/);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS n FROM workshops").get().n,
    catalogue.workshops.length,
  );
  assert.equal(
    statementSql({
      sql: "SELECT ?,?,?",
      params: ["x'); DROP TABLE workshops; --", null, 42],
    }),
    "SELECT 'x''); DROP TABLE workshops; --',NULL,42;",
  );
  await writeFile(planPath, JSON.stringify(plan));
  await assert.rejects(
    applyCatalogueRelease({
      planPath,
      root,
      commit: "b".repeat(40),
      cli: "fixture",
      config: "fixture",
      directory,
      run,
      options: {},
    }),
    /does not match/,
  );
  console.log(
    "Released catalogue plan: central runtime statements, bounded imports, interruption/retry, admin preservation and tampering rejection passed",
  );
} finally {
  sqlite.close();
  await rm(directory, { recursive: true, force: true });
}
