import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { loadMigrationSet, snapshotDatabase, restoreSnapshot, upgradeSnapshot, planDataTransfer, validateSnapshot, validateEvidenceManifest, verifyEvidenceFiles } from "../scripts/data-transfer.mjs";

const migrations = await loadMigrationSet();
const metadata = { projectId: "source-fixture", sourceCommit: "a".repeat(40), exportedAt: "2026-10-04T17:00:00Z" };
function fixture(count, history = "d1") {
  const db = new DatabaseSync(":memory:");
  for (const migration of migrations.slice(0, count)) db.exec(migration.sql);
  if (history === "d1") {
    db.exec("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)");
    for (const migration of migrations.slice(0, count)) db.prepare("INSERT INTO d1_migrations(name) VALUES (?)").run(migration.name);
  } else if (history === "drizzle") {
    db.exec("CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)");
    for (const migration of migrations.slice(0, count)) db.prepare("INSERT INTO __drizzle_migrations(hash,created_at) VALUES (?,?)").run(migration.sha256, migration.when);
  }
  return db;
}
function oldSource() {
  const db = fixture(9);
  db.prepare("INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,file_key,status,created_at,rating,review) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run("visit-fixture", "native-owner-fixture", "workshop-fixture", "2026-10-01", "vehicle-fixture", "repair", "upload", "private/receipt-fixture", "published", "2026-10-01", 4, "fixture review");
  db.prepare("INSERT INTO auth_links(account_id,legacy_owner,created_at) VALUES(?,?,?)").run("supabase:project-fixture:user-fixture", "native-owner-fixture", "2026-10-01");
  db.prepare("INSERT INTO auth_account_roles(account_id,assigned_at,assigned_by) VALUES(?,?,?)").run("native-owner-fixture", "2026-10-01", "fixture-bootstrap");
  db.exec("CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB)");
  db.prepare("INSERT INTO _cf_KV VALUES(?,?)").run("provider-fixture", new Uint8Array([0, 1, 128, 255]));
  const result = snapshotDatabase(db, metadata);
  db.close();
  return result;
}
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`ok ${name}`); }
const source = oldSource();
const targetDb = fixture(migrations.length);
const target = snapshotDatabase(targetDb, { ...metadata, projectId: "target-fixture" });
targetDb.close();

test("all existing tables and history are exported, including opaque provider bytes", () => {
  const values = source.tables.find((table) => table.name === "_cf_KV").rows;
  assert.deepEqual(values[0].value, { type: "blob", base64: "AAGA/w==" });
  assert(source.tables.some((table) => table.name === "sqlite_sequence"));
});
test("exact old schema upgrades only its proven missing migration suffix", () => {
  const result = upgradeSnapshot(source, migrations);
  assert.equal(result.proof.count, 9);
  assert.deepEqual(result.proof.applied, migrations.slice(9).map((item) => item.name));
  assert.equal(result.sourceArchive.tables.find((table) => table.name === "d1_migrations").rows.length, 9);
  assert.equal(result.sourceArchive.tables.find((table) => table.name === "_cf_KV").rows[0].value.base64, "AAGA/w==");
  assert.equal(result.snapshot.tables.find((table) => table.name === "review_notifications").rows.length, 0);
  assert.equal(result.snapshot.tables.find((table) => table.name === "visits").rows[0].owner, "native-owner-fixture");
});
const plan = planDataTransfer(source, target, { migrations });
test("destination plan inserts business data and preserves owner/status links", () => {
  assert.equal(plan.statements.length, 3);
  assert(!plan.statements.some((statement) => statement.table.startsWith("_cf_") || statement.table === "d1_migrations"));
  assert(plan.statements.find((statement) => statement.table === "visits").params.includes("native-owner-fixture"));
  assert(plan.statements.find((statement) => statement.table === "visits").params.includes("published"));
  assert(plan.statements.find((statement) => statement.table === "auth_links").params.includes("supabase:project-fixture:user-fixture"));
});
test("repeating a completed transfer produces only unchanged rows", () => {
  const db = fixture(migrations.length);
  for (const statement of plan.statements) db.prepare(statement.sql).run(...statement.params);
  const retry = planDataTransfer(source, snapshotDatabase(db, { ...metadata, projectId: "target-fixture" }), { migrations });
  assert.equal(retry.statements.length, 0);
  assert.equal(retry.summary.reduce((sum, table) => sum + table.unchanged, 0), 3);
  db.close();
});
test("destination-only rows remain protected and appear in reconciliation counts", () => {
  const db = fixture(migrations.length);
  db.prepare("INSERT INTO auth_links(account_id,legacy_owner,created_at) VALUES(?,?,?)").run("destination-only-fixture", "destination-owner-fixture", "2026-10-01");
  const additional = planDataTransfer(source, snapshotDatabase(db, { ...metadata, projectId: "target-fixture" }), { migrations });
  assert.equal(additional.summary.find((table) => table.table === "auth_links").destinationOnly, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_links").get().n, 1);
  db.close();
});
test("conflicting primary keys do not overwrite newer destination data or leak values", () => {
  const db = fixture(migrations.length);
  for (const statement of plan.statements) db.prepare(statement.sql).run(...statement.params);
  db.prepare("UPDATE visits SET owner=?").run("PRIVATE-CONFLICT-IDENTITY");
  assert.throws(() => planDataTransfer(source, snapshotDatabase(db, { ...metadata, projectId: "target-fixture" }), { migrations }), (error) => /Conflicting destination row in table visits/.test(error.message) && !error.message.includes("PRIVATE-CONFLICT"));
  assert.equal(db.prepare("SELECT owner FROM visits").get().owner, "PRIVATE-CONFLICT-IDENTITY");
  db.close();
});
test("unique alternate keys are checked before producing a writable plan", () => {
  const db = fixture(migrations.length);
  db.prepare("INSERT INTO auth_links(account_id,legacy_owner,created_at) VALUES(?,?,?)").run("another-account-fixture", "native-owner-fixture", "2026-10-01");
  assert.throws(() => planDataTransfer(source, snapshotDatabase(db, { ...metadata, projectId: "target-fixture" }), { migrations }), /Destination constraint conflict in table auth_links/);
  db.close();
});
test("schema alteration beyond a known migration prefix blocks restore", () => {
  const altered = structuredClone(source);
  altered.schema.find((item) => item.name === "visits").sql += "; ATTACH '/private-file' AS stolen";
  assert.throws(() => restoreSnapshot(altered, migrations), /does not match one unique/);
});
test("missing column inventory is rejected even when CREATE SQL matches", () => {
  const altered = structuredClone(source);
  altered.tables.find((item) => item.name === "visits").columns[0].type = "INTEGER";
  assert.throws(() => restoreSnapshot(altered, migrations), /does not match one unique/);
});
test("misordered, missing, or modified D1 history blocks transfer", () => {
  for (const mutation of [(rows) => rows.pop(), (rows) => { rows[0].name = "foreign.sql"; }, (rows) => { [rows[0].name, rows[1].name] = [rows[1].name, rows[0].name]; }]) {
    const altered = structuredClone(source);
    mutation(altered.tables.find((item) => item.name === "d1_migrations").rows);
    assert.throws(() => restoreSnapshot(altered, migrations), /migration history/i);
  }
});
test("Drizzle null SERIAL ids remain valid only with exact hashes and timestamps", () => {
  const db = fixture(9, "drizzle");
  const snapshot = snapshotDatabase(db, metadata);
  const restored = restoreSnapshot(snapshot, migrations);
  assert.equal(restored.proof.count, 9);
  restored.database.close();
  snapshot.tables.find((item) => item.name === "__drizzle_migrations").rows[0].hash = "wrong";
  assert.throws(() => restoreSnapshot(snapshot, migrations), /Drizzle migration history/);
  db.close();
});
test("absent history is explicit with complete structural proof, never fabricated", () => {
  const db = fixture(9, null);
  const restored = restoreSnapshot(snapshotDatabase(db, metadata), migrations);
  assert.equal(restored.proof.historyAbsent, true);
  assert.deepEqual(restored.sourceHistory, []);
  restored.database.close(); db.close();
});
test("already migrated source adds no schema changes; destination must be current", () => {
  const db = fixture(migrations.length);
  assert.deepEqual(upgradeSnapshot(snapshotDatabase(db, metadata), migrations).proof.applied, []);
  const oldTarget = fixture(9);
  assert.throws(() => planDataTransfer(source, snapshotDatabase(oldTarget, { ...metadata, projectId: "target-fixture" }), { migrations }), /Destination must have every/);
  oldTarget.close(); db.close();
});
test("invalid scalars, unsafe integers, and malformed blobs do not silently change data", () => {
  for (const value of [true, NaN, Number.MAX_SAFE_INTEGER + 1, { type: "blob", base64: "!!!" }, { type: "blob", base64: "AA==", extra: 1 }]) {
    const altered = structuredClone(source);
    altered.tables.find((item) => item.name === "visits").rows[0].owner = value;
    assert.throws(() => validateSnapshot(altered), /Invalid SQLite scalar row/);
  }
});
const evidence = Buffer.from("isolated evidence fixture");
const object = { key: "private/receipt-fixture", file: "objects/0001.bin", size: evidence.length, sha256: createHash("sha256").update(evidence).digest("hex"), httpMetadata: { contentType: "image/png", contentDisposition: "attachment" }, customMetadata: { fixture: "true" } };
const manifest = { format: 1, projectId: metadata.projectId, exportedAt: metadata.exportedAt, objects: [object] };
test("manifest verifies exact references and retains private HTTP/custom metadata", () => {
  assert.deepEqual(validateEvidenceManifest(source, manifest), { objects: 1, references: 1, unreferenced: 0 });
});
test("missing visits and pending upload references are blockers", () => {
  assert.throws(() => validateEvidenceManifest(source, { ...manifest, objects: [] }), /Referenced evidence is missing/);
  const upgraded = upgradeSnapshot(source, migrations).snapshot;
  upgraded.tables.find((table) => table.name === "evidence_uploads").rows.push({ file_key: "missing-fixture-upload", owner: "native-owner-fixture" });
  assert.throws(() => validateEvidenceManifest(upgraded, manifest), /Referenced evidence is missing.*evidence_uploads/);
});
test("duplicate keys and unsafe paths are rejected", () => {
  assert.throws(() => validateEvidenceManifest(source, { ...manifest, objects: [object, object] }), /duplicate evidence/);
  for (const file of ["../private", "/private", "C:/private", "objects/../private", "objects\\private", "objects//file"]) assert.throws(() => validateEvidenceManifest(source, { ...manifest, objects: [{ ...object, file }] }), /Invalid or duplicate/);
});
const directory = await mkdtemp(join(tmpdir(), "riparim-transfer-fixture-"));
try {
  await writeFile(join(directory, "0001.bin"), evidence, { mode: 0o600 });
  assert.deepEqual(await verifyEvidenceFiles({ ...manifest, objects: [{ ...object, file: "0001.bin" }] }, directory), { objects: 1, bytes: evidence.length }); checks++;
  await assert.rejects(verifyEvidenceFiles({ ...manifest, objects: [{ ...object, file: "0001.bin", sha256: "0".repeat(64) }] }, directory), /checksum or size mismatch/); checks++;
  await assert.rejects(verifyEvidenceFiles({ ...manifest, objects: [{ ...object, file: "missing.bin" }] }, directory), /file is missing/); checks++;
  const outside = await mkdtemp(join(tmpdir(), "riparim-outside-fixture-"));
  try {
    await writeFile(join(outside, "outside.bin"), evidence);
    await symlink(join(outside, "outside.bin"), join(directory, "link.bin"));
    await assert.rejects(verifyEvidenceFiles({ ...manifest, objects: [{ ...object, file: "link.bin" }] }, directory), /escapes its protected directory/); checks++;
  } finally { await rm(outside, { recursive: true, force: true }); }
} finally { await rm(directory, { recursive: true, force: true }); }
console.log(`${checks} data transfer checks passed.`);
