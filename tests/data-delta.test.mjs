import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { loadMigrationSet, snapshotDatabase, restoreSnapshot } from "../scripts/data-transfer.mjs";
import { destinationFingerprint } from "../scripts/import-d1.mjs";
import { workshopIdentityInput } from "../lib/google-identity-fingerprint.mjs";
import { reconstructTransferredBaseline, compareSnapshotTables, planDataDelta, projectExpiredAuthAttempts, applyDeltaChunkToSnapshot } from "../scripts/data-delta.mjs";

const migrations = await loadMigrationSet();
const previousAt = "2020-01-01T12:00:00.000Z";
const currentAt = "2020-01-01T13:00:00.000Z";
const trustedExecutorTime = "2020-01-01T13:10:00.000Z";
const profile = { id: "profile-fixture", name: "Fixture Workshop", city: "Fixture City", address: "Fixture Address", phone: "+38344123456", phone_note: "", whatsapp: "", brands: "[]", services: "[]", service_details: "[]", languages: "[]", specialty: "fixture", description: "fixture", lat: "42.5", lng: "20.8", sources: "[]", checked_at: previousAt, status: "published", updated_at: previousAt };
const rating = { workshop_id: profile.id, rating: 4.5, review_count: 3, maps_url: "https://maps.google.com/?cid=123", source_url: null, source_label: null, checked_at: previousAt, source_updated_at: null };
const cacheHash = createHash("sha256").update(workshopIdentityInput({ ...profile, lat: Number(profile.lat), lng: Number(profile.lng), googleRating: { mapsUrl: rating.maps_url } })).digest("hex");
const rows = (snapshot, table) => snapshot.tables.find((item) => item.name === table).rows;
function dbFixture() {
  const database = new DatabaseSync(":memory:"); for (const migration of migrations) database.exec(migration.sql);
  database.exec("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  for (const migration of migrations) database.prepare("INSERT INTO d1_migrations(name) VALUES(?)").run(migration.name);
  return database;
}
function insert(database, table, row) { const columns = Object.keys(row); database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`).run(...Object.values(row)); }
function fixture() {
  const db = dbFixture();
  for (const [table, row] of [["workshops", profile], ["workshop_google_ratings", rating], ["workshop_google_places", { workshop_id: profile.id, place_id: "place-fixture", profile_hash: "0".repeat(64), checked_at: 100, retry_after: 1000 }], ["catalog_state", { key: `workshop-source:${"a".repeat(64)}`, value: previousAt }], ["auth_settings", { id: "settings-fixture", project_url: "https://fixture.supabase.co", public_key: "publishable-fixture", enabled: 1, email_delivery_confirmed: 1, updated_at: previousAt }], ["auth_account_roles", { account_id: "supabase:fixture:owner", role: "admin", assigned_at: previousAt, assigned_by: "bootstrap-fixture" }], ["auth_account_status", { account_id: "supabase:fixture:owner", status: "active", updated_at: previousAt }], ["auth_sessions", { id: "session-fixture", account_id: "supabase:fixture:owner", revoked: 0, legacy_access: 0, expires_at: 9999999999999, created_at: previousAt, provider: "password", google_subject: null, moderator: 0 }], ["auth_links", { account_id: "supabase:fixture:owner", legacy_owner: "native-fixture", owner_admin: 0, created_at: previousAt, password_access: 1 }], ["visits", { id: "visit-fixture", owner: "supabase:fixture:owner", workshop: profile.id, date: "2020-01-01", vehicle: "fixture", service: "fixture", evidence_type: "note", status: "published", created_at: previousAt, rating: 4, review: "private fixture" }]]) insert(db, table, row);
  const source = snapshotDatabase(db, { projectId: "source-fixture", sourceCommit: "a".repeat(40), exportedAt: previousAt, excludedProviderTables: [] }); db.close();
  const target = structuredClone(source); target.projectId = "target-fixture";
  rows(target, "workshop_google_places")[0] = { ...rows(target, "workshop_google_places")[0], profile_hash: cacheHash, checked_at: 200, retry_after: 2000 };
  rows(target, "catalog_state")[0].value = "2020-01-01T12:10:00.000Z";
  const currentSource = structuredClone(source); const currentTarget = structuredClone(target);
  currentSource.exportedAt = currentTarget.exportedAt = currentAt;
  return { source, target, currentSource, currentTarget, expected: destinationFingerprint(target) };
}
const plan = (state, extra = {}) => planDataDelta(state.source, state.target, state.currentSource, state.currentTarget, { migrations, expectedBaselineFingerprint: state.expected, trustedExecutorTime, ...extra });
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`ok ${name}`); }

test("offline reconstruction requires the exact completed transfer fingerprint", () => {
  const state = fixture();
  const preTarget = structuredClone(state.target);
  rows(preTarget, "auth_sessions").splice(0);
  const reconstructed = reconstructTransferredBaseline(state.source, preTarget, { migrations, expectedFingerprint: state.expected, expectedInserted: 1, expectedRetainedMetadata: 2 });
  assert.equal(destinationFingerprint(reconstructed.snapshot), state.expected);
  assert.throws(() => reconstructTransferredBaseline(state.source, preTarget, { migrations, expectedFingerprint: "0".repeat(64) }), /completed fingerprint/);
  assert.throws(() => reconstructTransferredBaseline(state.source, preTarget, { migrations, expectedFingerprint: state.expected, expectedInserted: 99 }), /completed report/);
});
test("unchanged source is a no-op while exact proven cache metadata stays retained", () => {
  const state = fixture(); const result = plan(state);
  assert.equal(result.statements.length, 0); assert.equal(result.retainedMetadata, 2);
  assert.equal(result.desiredFingerprint, state.expected);
});
test("revocations, moderation changes and source deletions never resurrect rows", () => {
  const state = fixture();
  rows(state.currentSource, "auth_account_roles").splice(0);
  rows(state.currentSource, "auth_sessions")[0].revoked = 1;
  rows(state.currentSource, "auth_account_status")[0].status = "deleted";
  rows(state.currentSource, "visits").splice(0);
  const result = plan(state);
  assert.deepEqual(result.statements.map((row) => row.operation).sort(), ["delete", "delete", "update", "update"]);
  assert(result.statements.filter((row) => row.operation !== "insert").every((row) => / WHERE .* IS \?/.test(row.sql)));
  const after = applyDeltaChunkToSnapshot(state.currentTarget, result.statements);
  assert.equal(rows(after, "auth_account_roles").length, 0);
  assert.equal(rows(after, "visits").length, 0);
  assert.equal(rows(after, "auth_sessions")[0].revoked, 1);
  assert.equal(rows(after, "auth_account_status")[0].status, "deleted");
  state.currentTarget = after;
  assert.equal(plan(state).statements.length, 0, "safe retry after committed deletions is a no-op");
});
test("new rows copy only exact source identities and grant/deletion state", () => {
  const state = fixture();
  rows(state.currentSource, "auth_account_deletions").push({ account_id: "supabase:fixture:owner", user_id: "owner", token_hash: "fixture-token-hash", expires_at: 99999999999, started: 1 });
  const result = plan(state);
  assert.equal(result.statements.length, 1); assert.equal(result.statements[0].operation, "insert");
  assert.equal(result.statements[0].after.started, 1);
  assert(result.statements[0].params.includes("supabase:fixture:owner"));
});
test("null-safe full-row CAS protects data changes and a late race", () => {
  const state = fixture();
  rows(state.currentSource, "visits")[0].status = "pending";
  rows(state.currentSource, "visits")[0].moderated_by = "admin-fixture";
  rows(state.currentSource, "visits")[0].evidence_note = "'; DELETE FROM auth_account_roles; --";
  const mutation = plan(state).statements[0];
  const restored = restoreSnapshot(state.currentTarget, migrations);
  assert.equal(restored.database.prepare(mutation.sql).run(...mutation.params).changes, 1);
  assert.equal(restored.database.prepare("SELECT evidence_note FROM visits").get().evidence_note, rows(state.currentSource, "visits")[0].evidence_note);
  assert.equal(restored.database.prepare("SELECT COUNT(*) AS n FROM auth_account_roles").get().n, 1);
  restored.database.close();
  const raced = restoreSnapshot(state.currentTarget, migrations);
  raced.database.prepare("UPDATE visits SET moderator_note=?").run("foreign private fixture");
  assert.equal(raced.database.prepare(mutation.sql).run(...mutation.params).changes, 0);
  assert.equal(raced.database.prepare("SELECT status FROM visits").get().status, "published"); raced.database.close();
});
test("unknown target changes, missing rows and additions remain hard conflicts", () => {
  for (const mutation of [
    (state) => { rows(state.currentTarget, "auth_sessions")[0].moderator = 1; },
    (state) => { rows(state.currentTarget, "auth_account_roles").splice(0); },
    (state) => { rows(state.currentTarget, "catalog_state").push({ key: "unknown-target-fixture", value: "private" }); },
    (state) => { rows(state.currentTarget, "visits")[0].owner = "foreign-private-owner-fixture"; },
  ]) {
    const state = fixture(); mutation(state);
    assert.throws(() => plan(state), (error) => /Unexpected target drift/.test(error.message) && !error.message.includes("foreign-private-owner"));
  }
});
test("a source provider-project switch is a domain-delta No-Go", () => {
  const state = fixture(); rows(state.currentSource, "auth_settings")[0].project_url = "https://foreign.supabase.co";
  assert.throws(() => plan(state), /Auth project identity changed/);
});
test("business identity changes invalidate retained old cache hashes", () => {
  const state = fixture(); rows(state.currentSource, "workshops")[0].phone = "+38344999999";
  const result = plan(state);
  assert.equal(result.retainedMetadata, 1);
  assert(result.statements.some((row) => row.table === "workshop_google_places" && row.operation === "update"));
  assert.equal(rows(result.desiredSnapshot, "workshop_google_places")[0].profile_hash, "0".repeat(64));
});
test("known target-only records are preserved and colliding new source rows are blocked", () => {
  const state = fixture();
  rows(state.target, "catalog_state").push({ key: "known-target-fixture", value: "known" });
  state.currentTarget = structuredClone(state.target); state.currentTarget.exportedAt = currentAt;
  state.expected = destinationFingerprint(state.target);
  assert.equal(plan(state).statements.length, 0);
  rows(state.currentSource, "catalog_state").push({ key: "known-target-fixture", value: "different" });
  assert.throws(() => plan(state), /Independent source insertion/);
});
test("target migration metadata or forged schema never enters a delta", () => {
  const state = fixture(); rows(state.currentTarget, "d1_migrations")[0].applied_at = "foreign-metadata";
  assert.throws(() => plan(state), /provider or migration metadata changed/);
  state.currentTarget = structuredClone(state.target);
  state.currentSource.schema.find((row) => row.name === "visits").sql += "; ATTACH '/private' AS stolen";
  assert.throws(() => plan(state), /unique checked-in migration prefix/);
});
function counter(at, digit, attempts = 1) { const time = Date.parse(at); const window = Math.floor(time / 600000); return { key: `${digit.repeat(64)}:${window}`, attempts, expires_at: time + 1200000 }; }
function expiryFixture() {
  const state = fixture();
  rows(state.source, "auth_attempts").push(counter("2020-01-01T11:30:00.000Z", "a"));
  rows(state.target, "auth_attempts").push(...structuredClone(rows(state.source, "auth_attempts")));
  rows(state.currentSource, "auth_attempts").push(...structuredClone(rows(state.source, "auth_attempts")));
  rows(state.currentTarget, "auth_attempts").push(counter("2020-01-01T12:10:00.000Z", "b"));
  state.expected = destinationFingerprint(state.target);
  return state;
}
test("default expiry handling remains strict despite inactive rate-limit drift", () => {
  assert.throws(() => plan(expiryFixture()), /Unexpected target drift/);
});
test("fixed expiry projection retains raw target rows without restoring source garbage", () => {
  const state = expiryFixture(); const before = structuredClone(state);
  const result = plan(state, { allowExpiredAuthAttemptsAt: currentAt });
  assert.equal(result.statements.length, 0);
  assert.deepEqual(result.expiredAuthAttempts, { cutoff: currentAt, sourceExcluded: 1, targetRetained: 1 });
  assert.deepEqual(rows(result.desiredSnapshot, "auth_attempts"), rows(state.currentTarget, "auth_attempts"));
  assert.equal(result.desiredFingerprint, destinationFingerprint(state.currentTarget));
  assert.deepEqual(state, before, "raw immutable backups are not rewritten");
});
test("fresh active source counters still transfer with fixed expired projection", () => {
  const state = expiryFixture(); rows(state.currentSource, "auth_attempts").push(counter("2020-01-01T12:50:00.000Z", "c", 3));
  const result = plan(state, { allowExpiredAuthAttemptsAt: currentAt });
  assert.equal(result.statements.length, 1); assert.equal(result.statements[0].operation, "insert");
  assert.equal(rows(result.desiredSnapshot, "auth_attempts").length, 2);
});
test("changed active counters and permissions cannot be forgiven by expiry projection", () => {
  const state = fixture(); const active = counter("2020-01-01T12:50:00.000Z", "d");
  for (const snapshot of [state.source, state.target, state.currentSource, state.currentTarget]) rows(snapshot, "auth_attempts").push(structuredClone(active));
  state.expected = destinationFingerprint(state.target);
  rows(state.currentTarget, "auth_attempts")[0].attempts = 99;
  assert.throws(() => plan(state, { allowExpiredAuthAttemptsAt: currentAt }), /Unexpected target drift/);
  rows(state.currentTarget, "auth_attempts")[0].attempts = 1;
  rows(state.currentTarget, "auth_account_roles")[0].assigned_by = "foreign";
  assert.throws(() => plan(state, { allowExpiredAuthAttemptsAt: currentAt }), /Unexpected target drift/);
});
test("future cutoffs, malformed runtime rows and expiry-window edits are rejected", () => {
  const state = expiryFixture();
  assert.throws(() => plan(state, { allowExpiredAuthAttemptsAt: "2020-01-01T13:01:00.000Z" }), /witnessed by both fresh/);
  assert.throws(() => projectExpiredAuthAttempts(state.target, { cutoff: "2020-01-01T13:20:00.000Z", trustedExecutorTime }), /trusted execution time/);
  assert.throws(() => projectExpiredAuthAttempts(state.target, { cutoff: "2020-02-30T13:00:00.000Z", trustedExecutorTime: "2021-01-01T00:00:00.000Z" }), /fixed and no later/);
  for (const mutation of [(row) => { row.key = "arbitrary"; }, (row) => { row.expires_at = 0; }, (row) => { row.attempts = -1; }, (row) => { row.expires_at += 600000; }]) {
    const bad = structuredClone(state.target); mutation(rows(bad, "auth_attempts")[0]);
    assert.throws(() => projectExpiredAuthAttempts(bad, { cutoff: currentAt, trustedExecutorTime }), /runtime window and expiry contract/);
  }
});
test("expiry at the exact cutoff is not classified as expired", () => {
  const state = fixture(); rows(state.target, "auth_attempts").push(counter("2020-01-01T12:40:00.000Z", "e"));
  assert.equal(projectExpiredAuthAttempts(state.target, { cutoff: currentAt, trustedExecutorTime }).expired, 0);
});
test("drift diagnostics disclose only table counts and fingerprints", () => {
  const state = fixture(); rows(state.currentTarget, "auth_sessions")[0].account_id = "PRIVATE-IDENTITY-FIXTURE";
  const diagnostic = compareSnapshotTables(state.target, state.currentTarget);
  assert.equal(diagnostic[0].table, "auth_sessions"); assert.equal(diagnostic[0].changed, 1);
  assert(!JSON.stringify(diagnostic).includes("PRIVATE-IDENTITY"));
});
console.log(`${checks} three-way data delta checks passed.`);
