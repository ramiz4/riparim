import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { workshopIdentityInput } from "../lib/google-identity-fingerprint.mjs";
import { loadMigrationSet, snapshotDatabase, restoreSnapshot, upgradeSnapshot, planDataTransfer, validateSnapshot, validateEvidenceManifest, verifyEvidenceFiles } from "../scripts/data-transfer.mjs";

const migrations = await loadMigrationSet();
const metadata = { projectId: "source-fixture", sourceCommit: "a".repeat(40), exportedAt: "2026-10-04T17:00:00Z" };
function fixture(count, history = "d1") {
  const db = new DatabaseSync(":memory:");
  for (const migration of migrations.slice(0, count)) db.exec(migration.sql);
  if (history === "d1" || history === "appgarden") {
    const name = history === "appgarden" ? "__appgarden_migrations" : "d1_migrations";
    db.exec(`CREATE TABLE "${name}"(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`);
    for (const migration of migrations.slice(0, count)) db.prepare(`INSERT INTO "${name}"(name) VALUES (?)`).run(migration.name);
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
test("the exact Sites migration-history alias proves old schema and stays archived", () => {
  const db = fixture(9, "appgarden");
  db.prepare("INSERT INTO auth_links(account_id,legacy_owner,created_at) VALUES(?,?,?)").run("provider-account-fixture", "legacy-owner-fixture", "2026-10-04");
  const snapshot = snapshotDatabase(db, metadata);
  const original = structuredClone(snapshot.tables.find((table) => table.name === "__appgarden_migrations"));
  const result = upgradeSnapshot(snapshot, migrations);
  assert.equal(result.proof.count, 9);
  assert.deepEqual(result.proof.history, ["__appgarden_migrations"]);
  assert.deepEqual(result.sourceHistory[0], original);
  assert.deepEqual(result.sourceArchive.tables.find((table) => table.name === "__appgarden_migrations"), original);
  assert.equal(result.snapshot.tables.find((table) => table.name === "auth_links").rows[0].legacy_owner, "legacy-owner-fixture");
  const plan = planDataTransfer(snapshot, target, { migrations });
  assert.equal(plan.statements.length, 1);
  assert(plan.statements.every((statement) => statement.table !== "__appgarden_migrations" && statement.table !== "d1_migrations"));
  assert.deepEqual(plan.sourceHistory[0], original);
  db.close();
});
test("current Sites history matches all checked-in names without schema migration", () => {
  const db = fixture(migrations.length, "appgarden");
  const result = upgradeSnapshot(snapshotDatabase(db, metadata), migrations);
  assert.deepEqual(result.proof.applied, []);
  assert.equal(result.sourceHistory[0].rows.length, migrations.length);
  db.close();
});
test("missing, misordered or foreign Sites migration names remain hard blockers", () => {
  const db = fixture(9, "appgarden");
  const snapshot = snapshotDatabase(db, metadata);
  for (const mutation of [(rows) => rows.pop(), (rows) => { rows[0].name = "foreign.sql"; }, (rows) => { [rows[0].name, rows[1].name] = [rows[1].name, rows[0].name]; }]) {
    const altered = structuredClone(snapshot);
    mutation(altered.tables.find((table) => table.name === "__appgarden_migrations").rows);
    assert.throws(() => restoreSnapshot(altered, migrations), /migration history/i);
  }
  db.close();
});
test("Sites history schema cannot hide additional data columns or changed constraints", () => {
  const db = fixture(9, "appgarden");
  const snapshot = snapshotDatabase(db, metadata);
  const sqlChange = structuredClone(snapshot);
  sqlChange.schema.find((item) => item.name === "__appgarden_migrations").sql = sqlChange.schema.find((item) => item.name === "__appgarden_migrations").sql.replace("name TEXT UNIQUE", "name TEXT");
  assert.throws(() => restoreSnapshot(sqlChange, migrations), /verified provider contract/);
  const columnChange = structuredClone(snapshot);
  columnChange.tables.find((item) => item.name === "__appgarden_migrations").columns[2].type = "TEXT";
  assert.throws(() => restoreSnapshot(columnChange, migrations), /verified provider contract/);
  db.close();
});
test("similar provider names and changed application schema are never whitelisted", () => {
  const db = fixture(9, "appgarden");
  db.exec("CREATE TABLE __appgarden_private_data(id TEXT PRIMARY KEY,value TEXT)");
  assert.throws(() => restoreSnapshot(snapshotDatabase(db, metadata), migrations), /does not match one unique/);
  db.exec("DROP TABLE __appgarden_private_data; ALTER TABLE visits ADD unexpected TEXT");
  assert.throws(() => restoreSnapshot(snapshotDatabase(db, metadata), migrations), /does not match one unique/);
  db.close();
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
function cacheFixtures() {
  const profile = { id: "metadata-workshop-fixture", name: "Fixture Workshop", city: "Fixture City", address: "Fixture Address", phone: "+38344123456", phone_note: "", whatsapp: "", brands: "[]", services: "[]", service_details: "[]", languages: "[]", specialty: "fixture", description: "fixture description", lat: "42.5", lng: "20.8", sources: "[]", checked_at: "2026-10-04T20:00:00Z", status: "published", updated_at: "2026-10-04T20:00:00Z" };
  const rating = { workshop_id: profile.id, rating: 4.5, review_count: 3, maps_url: "https://maps.google.com/?cid=123", source_url: null, source_label: null, checked_at: "2026-10-04T20:00:00Z", source_updated_at: null };
  const currentHash = createHash("sha256").update(workshopIdentityInput({ ...profile, lat: Number(profile.lat), lng: Number(profile.lng), googleRating: { mapsUrl: rating.maps_url } })).digest("hex");
  function snapshot(source) {
    const db = fixture(migrations.length);
    for (const [table, row] of [["workshops", profile], ["workshop_google_ratings", rating], ["catalog_state", { key: `workshop-source:${"a".repeat(64)}`, value: source ? "2026-10-04T20:00:00Z" : "2026-10-04T21:00:00.000Z" }], ["workshop_google_places", { workshop_id: profile.id, place_id: "place-fixture", profile_hash: source ? "0".repeat(64) : currentHash, checked_at: source ? 100 : 200, retry_after: source ? 1000 : 2000 }]]) {
      const columns = Object.keys(row);
      db.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`).run(...Object.values(row));
    }
    const result = snapshotDatabase(db, { ...metadata, projectId: source ? "source-fixture" : "target-fixture" }); db.close(); return result;
  }
  return { source: snapshot(true), target: snapshot(false), currentHash };
}
test("cache metadata remains conflicting by default and needs explicit validated retention", () => {
  const cache = cacheFixtures();
  assert.throws(() => planDataTransfer(cache.source, cache.target, { migrations }), /Conflicting destination row/);
  const before = structuredClone(cache);
  const plan = planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true });
  assert.equal(plan.retainedMetadata, 2);
  assert.equal(plan.statements.length, 0);
  assert.equal(plan.summary.find((row) => row.table === "catalog_state").retainedMetadata, 1);
  assert.equal(plan.summary.find((row) => row.table === "workshop_google_places").retainedMetadata, 1);
  assert.equal(plan.summary.find((row) => row.table === "workshop_google_places").unchanged, 0);
  assert.deepEqual(cache, before, "original snapshots and metadata remain exact");
});
test("matching-place current hash validates time-only retention, missing cache rows insert normally", () => {
  const cache = cacheFixtures();
  cache.source.tables.find((table) => table.name === "workshop_google_places").rows[0].profile_hash = cache.currentHash;
  assert.equal(planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true }).retainedMetadata, 2);
  cache.target.tables.find((table) => table.name === "workshop_google_places").rows = [];
  const plan = planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true });
  assert.equal(plan.retainedMetadata, 1);
  assert.equal(plan.statements.length, 1);
  assert.equal(plan.statements[0].table, "workshop_google_places");
  assert.match(plan.statements[0].sql, /^INSERT /);
});
test("invalid place IDs, stale target hashes or malformed hash/time metadata cannot be retained", () => {
  for (const [side, column, value] of [["target", "place_id", "different-place-fixture"], ["target", "profile_hash", "f".repeat(64)], ["source", "profile_hash", "malformed"], ["target", "checked_at", -1], ["source", "retry_after", 1.5]]) {
    const cache = cacheFixtures();
    cache[side].tables.find((table) => table.name === "workshop_google_places").rows[0][column] = value;
    assert.throws(() => planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true }), /Conflicting destination row/);
  }
});
test("profile identity, full business data, publication and rating changes remain conflicts", () => {
  for (const [table, column, value] of [["workshops", "phone", "+38344999999"], ["workshops", "description", "changed private business fixture"], ["workshops", "status", "draft"], ["workshop_google_ratings", "maps_url", "https://maps.google.com/?cid=999"], ["workshop_google_ratings", "rating", 3.0]]) {
    const cache = cacheFixtures();
    cache.target.tables.find((entry) => entry.name === table).rows[0][column] = value;
    assert.throws(() => planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true }), /Conflicting destination row/);
  }
  const cache = cacheFixtures();
  cache.target.tables.find((table) => table.name === "workshops").rows = [];
  assert.throws(() => planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true }), /Conflicting destination row/);
});
test("seed marker validation rejects malformed timestamps and quota counter conflicts", () => {
  for (const value of ["not-a-date", "2026-02-30T20:00:00Z", "2026-10-04"]) {
    const cache = cacheFixtures();
    cache.source.tables.find((table) => table.name === "catalog_state").rows[0].value = value;
    assert.throws(() => planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true }), /Conflicting destination row/);
  }
  const cache = cacheFixtures();
  cache.source.tables.find((table) => table.name === "catalog_state").rows.push({ key: "google-places-quota:fixture", value: "1" });
  cache.target.tables.find((table) => table.name === "catalog_state").rows.push({ key: "google-places-quota:fixture", value: "2" });
  assert.throws(() => planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true }), /Conflicting destination row/);
});
test("ownership changes are never classified as cache metadata", () => {
  const cache = cacheFixtures();
  cache.source.tables.find((table) => table.name === "workshop_owners").rows.push({ workshop_id: "metadata-workshop-fixture", account_id: "source-owner-fixture", claim_id: "claim-fixture", confirmed_at: "2026-10-04", confirmed_by: "bootstrap-fixture" });
  cache.target.tables.find((table) => table.name === "workshop_owners").rows.push({ workshop_id: "metadata-workshop-fixture", account_id: "different-owner-fixture", claim_id: "claim-fixture", confirmed_at: "2026-10-04", confirmed_by: "bootstrap-fixture" });
  assert.throws(() => planDataTransfer(cache.source, cache.target, { migrations, retainValidatedCacheMetadata: true }), /Conflicting destination row/);
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
