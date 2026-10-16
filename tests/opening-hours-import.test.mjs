import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import {
  prepareOpeningHoursImport,
  validateOpeningHoursImport,
  openingHoursImportQuery,
  openingHoursImportQueries,
  csvRows,
  unresearchedOpeningHoursReason,
  openingHoursImportRevision,
} from "../scripts/lib/opening-hours-import.mjs";

await mkdir(".test-runtime/hours-import", { recursive: true });
await build({
  entryPoints: ["lib/opening-hours.ts"],
  outfile: ".test-runtime/hours-import/contract.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
});
const { openingHoursSchema } =
  await import("../.test-runtime/hours-import/contract.mjs");
const parse = (value) => openingHoursSchema.parse(value),
  catalogue = JSON.parse(await readFile("data/workshops.json", "utf8")),
  manifest = JSON.parse(
    await readFile("data/opening-hours-import.json", "utf8"),
  );
validateOpeningHoursImport(manifest, catalogue, parse);
assert.equal(manifest.records.length, 182);
assert.equal(
  manifest.records.filter((r) => r.metadata.kind === "assumed").length,
  30,
);
assert.equal(
  manifest.excluded.filter(
    (r) => r.reason === "Dauerhaft geschlossen laut Google Maps",
  ).length,
  1,
);
assert.equal(
  manifest.records.length + manifest.excluded.length,
  catalogue.workshops.length,
);
const one = { workshops: [catalogue.workshops[0]] },
  w = one.workshops[0];
const csv = `"Werkstatt-ID";"Name";"Ort";"Zeitzone";"Geprüft am";"Recherche-Status";${["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].join(";")}\n"${w.id}";"${w.name}";"${w.city}";Europe/Belgrade;2026-10-13;Gefunden;08:00-12:00,13:00-18:00;08:00-18:00;08:00-18:00;08:00-18:00;08:00-18:00;08:00-16:00;Geschlossen\n`;
assert.equal(
  prepareOpeningHoursImport(csv, one, parse).records[0].hours.week[0].intervals
    .length,
  2,
);
const unknownHours = prepareOpeningHoursImport(
  csv.replace("Gefunden", unresearchedOpeningHoursReason),
  one,
  parse,
);
assert.deepEqual(
  unknownHours.records,
  [],
  "Unresearched businesses receive no invented hours",
);
assert.deepEqual(unknownHours.excluded, [
  { id: w.id, reason: unresearchedOpeningHoursReason },
]);
validateOpeningHoursImport(unknownHours, one, parse);
const invalidExclusion = {
  ...unknownHours,
  excluded: [{ id: w.id, reason: "Other reason" }],
};
invalidExclusion.revision = openingHoursImportRevision(invalidExclusion);
assert.throws(
  () => validateOpeningHoursImport(invalidExclusion, one, parse),
  /Invalid excluded/,
);
const omitted = { ...unknownHours, excluded: [] };
omitted.revision = openingHoursImportRevision(omitted);
assert.throws(
  () => validateOpeningHoursImport(omitted, one, parse),
  /Incomplete/,
);
assert.throws(() =>
  prepareOpeningHoursImport(csv + csv.split("\n")[1] + "\n", one, parse),
);
assert.throws(() =>
  prepareOpeningHoursImport(csv.replace(w.id, "unknown-workshop"), one, parse),
);
assert.throws(() =>
  prepareOpeningHoursImport(
    csv.replace("08:00-12:00,13:00-18:00", "08:00-12:00,11:00-18:00"),
    one,
    parse,
  ),
);
assert.throws(() => csvRows('a;b\n"unterminated;b'));
assert.throws(() =>
  validateOpeningHoursImport(
    { ...manifest, revision: "forged" },
    catalogue,
    parse,
  ),
);
const db = new DatabaseSync(":memory:");
db.exec(
  "PRAGMA foreign_keys=ON; CREATE TABLE workshops(id TEXT PRIMARY KEY,name TEXT,city TEXT,address TEXT,phone TEXT,status TEXT,opening_hours TEXT,opening_hours_confirmed_at TEXT);",
);
db.exec(await readFile("drizzle/0022_daily_dreadnoughts.sql", "utf8"));
const insert = db.prepare("INSERT INTO workshops VALUES(?,?,?,?,?,?,?,?)");
for (const r of manifest.records)
  insert.run(
    r.id,
    r.expected.name,
    r.expected.city,
    r.expected.address,
    r.expected.phone,
    "published",
    null,
    null,
  );
const first = manifest.records[0];
db.prepare(
  "UPDATE workshops SET opening_hours=?,opening_hours_confirmed_at=? WHERE id=?",
).run(JSON.stringify(first.hours), "2026-10-12", first.id);
const apply = () => {
  const query = openingHoursImportQuery(manifest, "2026-10-13T12:00:00Z");
  return db.prepare(query.sql).run(...query.params);
};
const emptyQuery = openingHoursImportQuery(
  unknownHours,
  "2026-10-14T00:00:00Z",
);
assert.equal(
  db.prepare(emptyQuery.sql).run(...emptyQuery.params).changes,
  0,
  "Exclusions cannot create imported opening hours",
);
assert.equal(apply().changes, 182);
assert.equal(apply().changes, 0);
const otherRevision = { ...manifest, revision: "f".repeat(64) };
const unchangedPlans = openingHoursImportQuery(otherRevision);
assert.equal(
  db.prepare(unchangedPlans.sql).run(...unchangedPlans.params).changes,
  0,
  "Adding another workshop to a release preserves unchanged schedules and their revisions",
);
const translatedNotes = structuredClone(manifest);
translatedNotes.revision = "e".repeat(64);
translatedNotes.records[0].metadata.notes = "Editorial translation only";
const editorialQuery = openingHoursImportQuery(translatedNotes);
assert.equal(
  db.prepare(editorialQuery.sql).run(...editorialQuery.params).changes,
  0,
  "Editing source notes without a newer check must not rewrite imported evidence",
);
const olderRecord = structuredClone(manifest.records[0]);
olderRecord.metadata.checkedAt = "2026-10-12";
olderRecord.hours.week[0] = { mode: "closed" };
const staleQuery = openingHoursImportQuery({
  revision: "d".repeat(64),
  records: [olderRecord],
});
assert.equal(
  db.prepare(staleQuery.sql).run(...staleQuery.params).changes,
  0,
  "Older source evidence cannot replace a newer imported schedule",
);
assert.equal(
  db
    .prepare("SELECT opening_hours_confirmed_at FROM workshops WHERE id=?")
    .get(first.id).opening_hours_confirmed_at,
  "2026-10-12",
);
const importedBefore = db
  .prepare("SELECT * FROM workshop_opening_hours_imports ORDER BY workshop_id")
  .all();
db.prepare("UPDATE workshops SET phone=? WHERE id=?").run(
  "+383449999999",
  first.id,
);
assert.throws(apply, /NOT NULL/);
for (const query of openingHoursImportQueries(manifest))
  db.prepare(query.sql).run(...query.params);
assert.deepEqual(
  db
    .prepare(
      "SELECT * FROM workshop_opening_hours_imports ORDER BY workshop_id",
    )
    .all(),
  importedBefore,
  "Catalogue seeding preserves a changed identity; standalone import still rejects it",
);
db.prepare(
  "UPDATE workshops SET phone=?,opening_hours=NULL,opening_hours_confirmed_at=NULL WHERE id=?",
).run(first.expected.phone, first.id);
assert.equal(
  db
    .prepare(
      "SELECT suppressed FROM workshop_opening_hours_imports WHERE workshop_id=?",
    )
    .get(first.id).suppressed,
  1,
);
const previous = db
  .prepare("SELECT * FROM workshop_opening_hours_imports WHERE workshop_id=?")
  .get(first.id);
apply();
assert.deepEqual(
  db
    .prepare("SELECT * FROM workshop_opening_hours_imports WHERE workshop_id=?")
    .get(first.id),
  previous,
);
const tombstone = manifest.records[1];
db.prepare(
  "DELETE FROM workshop_opening_hours_imports WHERE workshop_id=?",
).run(tombstone.id);
db.prepare(
  "INSERT INTO workshop_opening_hours_imports(workshop_id,suppressed) VALUES(?,1)",
).run(tombstone.id);
apply();
assert.equal(
  db
    .prepare(
      "SELECT opening_hours FROM workshop_opening_hours_imports WHERE workshop_id=?",
    )
    .get(tombstone.id).opening_hours,
  null,
);
db.close();
console.log(
  "Hours import: 182 plans, 30 assumptions, strict CSV identities, atomic conflict rollback, idempotency, owner preservation and suppression tombstones passed",
);
