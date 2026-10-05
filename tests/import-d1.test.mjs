import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { workshopIdentityInput } from "../lib/google-identity-fingerprint.mjs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { loadMigrationSet, snapshotDatabase } from "../scripts/data-transfer.mjs";
import { exportSource } from "../scripts/export-source.mjs";
import { applyDataPlan, backupDestination, d1Destination, loadVerifiedSourceBackup, loadVerifiedDestinationBackup, snapshotDestination } from "../scripts/import-d1.mjs";

const migrations = await loadMigrationSet();
const sourceCommit = "a".repeat(40);
const expectedCommit = "b".repeat(40);
const sourceProjectId = "source-fixture";
const token = "CF_PRIVATE_FIXTURE_TOKEN_".repeat(2);
const parent = await mkdtemp(join(tmpdir(), "riparim-d1-import-fixture-"));
let sequence = 0;
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log(`ok ${name}`); }
function dbFixture(count) {
  const db = new DatabaseSync(":memory:");
  for (const migration of migrations.slice(0, count)) db.exec(migration.sql);
  db.exec("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  for (const migration of migrations.slice(0, count)) db.prepare("INSERT INTO d1_migrations(name) VALUES (?)").run(migration.name);
  return db;
}
const sourceDb = dbFixture(9);
for (let index = 0; index < 65; index++) sourceDb.prepare("INSERT INTO auth_attempts VALUES(?,?,?)").run(`attempt-fixture-${index}`, index % 3, 1791156000000);
sourceDb.prepare("INSERT INTO auth_links(account_id,legacy_owner,created_at) VALUES(?,?,?)").run("supabase:fixture:user-fixture", "legacy-owner-fixture", "2026-10-04");
sourceDb.prepare("INSERT INTO auth_account_roles(account_id,assigned_at,assigned_by) VALUES(?,?,?)").run("legacy-owner-fixture", "2026-10-04", "fixture-bootstrap");
for (let index = 0; index < 2; index++) sourceDb.prepare("INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,status,rating,review,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(`visit-fixture-${index}`, "legacy-owner-fixture", "workshop-fixture", "2026-10-04", "fixture-car", "fixture-repair", "note", index ? "needs_more" : "published", 4, "isolated fixture", "2026-10-04");
const sourceSnapshot = snapshotDatabase(sourceDb, { projectId: sourceProjectId, sourceCommit, exportedAt: "2026-10-04T20:00:00Z", excludedProviderTables: ["_cf_KV"] });
sourceDb.close();
const sourceDirectory = join(parent, "completed-source");
const sourceExport = await exportSource({ origin: "https://source-fixture.example", token: "a".repeat(64), expectedProjectId: sourceProjectId, expectedCommit: sourceCommit, directory: sourceDirectory,
  request: async (target) => {
    const url = new URL(target);
    switch (url.searchParams.get("operation")) {
      case "schema": return Response.json({ ...sourceSnapshot, tables: undefined, readOnly: true });
      case "table": {
        const table = sourceSnapshot.tables.find((item) => item.name === url.searchParams.get("table"));
        const offset = Number(url.searchParams.get("offset"));
        return Response.json({ name: table.name, columns: table.columns, rows: table.rows.slice(offset, offset + 5), nextOffset: offset + 5 < table.rows.length ? offset + 5 : null });
      }
      case "objects": return Response.json({ objects: [], cursor: null });
      default: throw new Error("Unexpected source fixture request");
    }
  },
});
const cacheProfile = { id: "cache-workshop-fixture", name: "Fixture Workshop", city: "Fixture City", address: "Fixture Address", phone: "+38344123456", phone_note: "", whatsapp: "", brands: "[]", services: "[]", service_details: "[]", languages: "[]", specialty: "fixture", description: "fixture description", lat: "42.5", lng: "20.8", sources: "[]", checked_at: "2026-10-04T20:00:00Z", status: "published", updated_at: "2026-10-04T20:00:00Z" };
const cacheRating = { workshop_id: cacheProfile.id, rating: 4.5, review_count: 3, maps_url: "https://maps.google.com/?cid=123", source_url: null, source_label: null, checked_at: "2026-10-04T20:00:00Z", source_updated_at: null };
const currentCacheHash = createHash("sha256").update(workshopIdentityInput({ ...cacheProfile, lat: Number(cacheProfile.lat), lng: Number(cacheProfile.lng), googleRating: { mapsUrl: cacheRating.maps_url } })).digest("hex");
function insertCacheFixture(db, source) {
  for (const [table, row] of [["workshops", cacheProfile], ["workshop_google_ratings", cacheRating], ["catalog_state", { key: `workshop-source:${"a".repeat(64)}`, value: source ? "2026-10-04T20:00:00Z" : "2026-10-04T21:00:00.000Z" }], ["workshop_google_places", { workshop_id: cacheProfile.id, place_id: "place-fixture", profile_hash: source ? "0".repeat(64) : currentCacheHash, checked_at: source ? 100 : 200, retry_after: source ? 1000 : 2000 }]]) {
    const columns = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`).run(...Object.values(row));
  }
}
const cacheSourceDb = dbFixture(9);
insertCacheFixture(cacheSourceDb, true);
for (let index = 0; index < 65; index++) cacheSourceDb.prepare("INSERT INTO auth_attempts VALUES(?,?,?)").run(`cache-import-fixture-${index}`, 0, 1000);
const cacheSnapshot = snapshotDatabase(cacheSourceDb, { projectId: sourceProjectId, sourceCommit, exportedAt: "2026-10-04T20:00:00Z", excludedProviderTables: ["_cf_KV"] });
cacheSourceDb.close();
const cacheSourceDirectory = join(parent, "completed-cache-source");
const cacheSourceExport = await exportSource({ origin: "https://source-fixture.example", token: "a".repeat(64), expectedProjectId: sourceProjectId, expectedCommit: sourceCommit, directory: cacheSourceDirectory,
  request: async (target) => {
    const url = new URL(target);
    if (url.searchParams.get("operation") === "schema") return Response.json({ ...cacheSnapshot, tables: undefined, readOnly: true });
    if (url.searchParams.get("operation") === "objects") return Response.json({ objects: [], cursor: null });
    const table = cacheSnapshot.tables.find((item) => item.name === url.searchParams.get("table"));
    const offset = Number(url.searchParams.get("offset"));
    return Response.json({ name: table.name, columns: table.columns, rows: table.rows.slice(offset, offset + 5), nextOffset: offset + 5 < table.rows.length ? offset + 5 : null });
  },
});
function apiFixture({ loseAck = false, failBatch = false, foreignChange = false, cacheMetadata = false } = {}) {
  const db = dbFixture(migrations.length);
  if (cacheMetadata) insertCacheFixture(db, false);
  db.exec("CREATE TABLE _cf_KV(key TEXT PRIMARY KEY,value BLOB)");
  db.prepare("INSERT INTO _cf_KV VALUES(?,?)").run("private-provider-fixture", new Uint8Array([0, 1, 255]));
  const writeBatches = [];
  const readQueries = [];
  let lost = false;
  const request = async (endpoint, options) => {
    assert.equal(endpoint, `https://api.cloudflare.com/client/v4/accounts/${d1Destination.accountId}/d1/database/${d1Destination.databaseId}/query`);
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert(!endpoint.includes(token));
    const body = JSON.parse(options.body);
    const write = Array.isArray(body.batch);
    const batch = write ? body.batch : [body];
    const result = [];
    let committed = false;
    if (write) { assert(batch.length <= 50); writeBatches.push(batch); db.exec("BEGIN"); }
    try {
      for (const [index, query] of batch.entries()) {
        if (write) {
          assert.match(query.sql, /^INSERT INTO "[a-z_]+" \(/);
          assert(!query.sql.includes("d1_migrations") && !query.sql.includes("_cf_KV") && !query.sql.includes("REPLACE") && !query.sql.includes("UPDATE"));
          if (failBatch && index === 9) throw new Error(`PRIVATE-FAILURE-${token}`);
          const meta = db.prepare(query.sql).run(...query.params);
          result.push({ success: true, results: [], meta: { changes: Number(meta.changes) } });
        } else {
          readQueries.push(query.sql);
          assert(!/FROM "?_cf_KV/.test(query.sql), "provider-reserved rows are never read");
          const rows = db.prepare(query.sql).all(...query.params).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Uint8Array ? [...value] : value])));
          result.push({ success: true, results: rows });
        }
      }
      if (write) {
        db.exec("COMMIT"); committed = true;
        if (foreignChange) db.prepare("INSERT INTO auth_attempts VALUES(?,?,?)").run("foreign-destination-fixture", 0, 100);
        if (loseAck && !lost) { lost = true; throw new Error(`PRIVATE-LOST-ACK-${token}`); }
      }
    } catch (error) {
      if (write && !committed) db.exec("ROLLBACK");
      if (loseAck && lost) throw error;
      return Response.json({ success: false, errors: [{ message: `PRIVATE-ERROR-${token}` }] });
    }
    return Response.json({ success: true, result });
  };
  return { db, request, writeBatches, readQueries };
}
const baselineDirectories = new WeakMap();
async function targetBaseline(api) {
  const baseline = await snapshotDestination({ token, expectedCommit, request: api.request });
  const directory = join(parent, `baseline-${++sequence}`);
  await backupDestination(baseline, directory);
  baselineDirectories.set(baseline, directory);
  return baseline;
}
const callOptions = (api, baseline, extra = {}) => ({ token, expectedCommit, destinationDirectory: baselineDirectories.get(baseline), sourceDirectory, expectedSourceProjectId: sourceProjectId, expectedSourceCommit: sourceCommit, expectedDestinationSnapshot: baseline, request: api.request, sourcePauseProbe: async () => sourceExport.report, readOnlyProbe: async (url) => { assert.equal(url, `${d1Destination.origin}/`); return new Response("maintenance fixture", { status: 503, headers: { "Cache-Control": "no-store", "X-Riparim-Migration-Read-Only": "true", "X-Riparim-Release-Commit": expectedCommit } }); }, ...extra });
try {
  await test("read-only destination snapshot pages all accessible data and archives histories", async () => {
    const api = apiFixture();
    const snapshot = await snapshotDestination({ token, expectedCommit, request: api.request });
    assert.equal(snapshot.projectId, d1Destination.databaseId);
    assert.deepEqual(snapshot.excludedProviderTables, ["_cf_KV"]);
    assert.equal(snapshot.tables.find((item) => item.name === "d1_migrations").rows.length, migrations.length);
    assert(snapshot.tables.some((item) => item.name === "sqlite_sequence"));
    assert.equal(api.writeBatches.length, 0);
    const report = await backupDestination(snapshot, join(parent, `destination-${++sequence}`));
    assert.equal(report.complete, true);
    assert.equal(report.excludedProviderTables[0], "_cf_KV");
    assert.equal((await stat(join(parent, `destination-${sequence}`, "snapshot.json"))).mode & 0o777, 0o600);
    api.db.close();
  });
  await test("verified completed source backup includes revalidated files and fingerprints", async () => {
    const result = await loadVerifiedSourceBackup({ directory: sourceDirectory, expectedProjectId: sourceProjectId, expectedCommit: sourceCommit });
    assert.equal(result.snapshot.sourceCommit, sourceCommit);
    assert.equal(result.report.complete, true);
    assert.equal(result.snapshot.tables.find((item) => item.name === "auth_links").rows[0].legacy_owner, "legacy-owner-fixture");
  });
  await test("default plan is read-only and ignores arbitrary caller SQL", async () => {
    const api = apiFixture(); const baseline = await targetBaseline(api);
    const result = await applyDataPlan(callOptions(api, baseline, { plan: { statements: [{ sql: "DELETE FROM visits" }] } }));
    assert.equal(result.executed, false); assert.equal(result.planned, 69);
    assert.equal(api.writeBatches.length, 0); api.db.close();
  });
  await test("explicit execution rechecks both pauses, inserts bounded chunks and preserves exact owners/status/history", async () => {
    const api = apiFixture(); const baseline = await targetBaseline(api);
    let probes = 0;
    const result = await applyDataPlan(callOptions(api, baseline, { execute: true, sourcePauseProbe: async () => { probes++; return sourceExport.report; } }));
    assert.equal(result.executed, true); assert.equal(result.inserted, 69);
    assert.deepEqual(api.writeBatches.map((batch) => batch.length), [50, 19]);
    assert(probes >= 4);
    assert.equal(api.db.prepare("SELECT owner FROM visits LIMIT 1").get().owner, "legacy-owner-fixture");
    assert.deepEqual(api.db.prepare("SELECT status FROM visits ORDER BY id").all().map((row) => row.status), ["published", "needs_more"]);
    assert.equal(api.db.prepare("SELECT COUNT(*) AS n FROM d1_migrations").get().n, migrations.length);
    assert.equal(api.db.prepare("SELECT COUNT(*) AS n FROM _cf_KV").get().n, 1);
    const fresh = await targetBaseline(api);
    const retry = await applyDataPlan(callOptions(api, fresh, { execute: true }));
    assert.equal(retry.inserted, 0); assert.equal(api.writeBatches.length, 2); api.db.close();
  });
  await test("missing authentication or paused state results in zero writes", async () => {
    for (const extra of [
      { sourcePauseProbe: undefined },
      { sourcePauseProbe: async () => ({ ...sourceExport.report, readOnly: false }) },
      { sourcePauseProbe: async () => ({ ...sourceExport.report, sourceProjectId: "foreign" }) },
      { sourcePauseProbe: async () => ({ ...sourceExport.report, sourceCommit: "c".repeat(40) }) },
      { sourcePauseProbe: async () => ({ ...sourceExport.report, dataFingerprint: "0".repeat(64) }) },
      { readOnlyProbe: async () => new Response("not paused", { status: 200 }) },
      { readOnlyProbe: async () => new Response("ambiguous outage", { status: 503 }) },
      { readOnlyProbe: async () => new Response("ordinary outage", { status: 503, headers: {"Cache-Control":"no-store"} }) },
      { readOnlyProbe: async () => new Response("wrong release", { status: 503, headers: {"Cache-Control":"no-store","X-Riparim-Migration-Read-Only":"true","X-Riparim-Release-Commit":"c".repeat(40)} }) },
    ]) {
      const api = apiFixture(); const baseline = await targetBaseline(api);
      await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true, ...extra })), /verifier|maintenance|snapshot changed/);
      assert.equal(api.writeBatches.length, 0); api.db.close();
    }
  });
  await test("source changing before final success blocks completion after safely retained chunks", async () => {
    const api = apiFixture(); const baseline = await targetBaseline(api);
    let probes = 0;
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true, sourcePauseProbe: async () => ({ ...sourceExport.report, objectsFingerprint: ++probes >= 3 ? "0".repeat(64) : sourceExport.report.objectsFingerprint }) })), /Source snapshot changed/);
    assert.equal(api.writeBatches.length, 2); assert.equal(api.db.prepare("SELECT COUNT(*) AS n FROM auth_attempts").get().n, 65); api.db.close();
  });
  await test("primary-key conflicts stop planning before any write", async () => {
    const api = apiFixture(); api.db.prepare("INSERT INTO auth_attempts VALUES(?,?,?)").run("attempt-fixture-0", 99, 1791156000000);
    const baseline = await targetBaseline(api);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true })), /Conflicting destination row/);
    assert.equal(api.writeBatches.length, 0); api.db.close();
  });
  await test("destination mutations after its backup prevent all writes", async () => {
    const api = apiFixture(); const baseline = await targetBaseline(api);
    api.db.prepare("INSERT INTO auth_attempts VALUES(?,?,?)").run("new-destination-fixture", 0, 100);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true })), /changed since its backup/);
    assert.equal(api.writeBatches.length, 0); api.db.close();
  });
  await test("foreign writes between acknowledged chunks stop further batches", async () => {
    const api = apiFixture({ foreignChange: true }); const baseline = await targetBaseline(api);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true })), /changed before the next transfer batch/);
    assert.equal(api.writeBatches.length, 1); api.db.close();
  });
  await test("failed batch acknowledgement is never blindly retried, fresh reconciliation safely resumes committed rows", async () => {
    const api = apiFixture({ loseAck: true }); const baseline = await targetBaseline(api);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true })), (error) => /acknowledgement failed/.test(error.message) && !error.message.includes(token));
    assert.equal(api.writeBatches.length, 1);
    assert.equal(api.db.prepare("SELECT COUNT(*) AS n FROM auth_attempts").get().n + api.db.prepare("SELECT COUNT(*) AS n FROM auth_account_roles").get().n, 50);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true })), /changed since its backup/);
    assert.equal(api.writeBatches.length, 1);
    const fresh = await targetBaseline(api);
    const retry = await applyDataPlan(callOptions(api, fresh, { execute: true }));
    assert.equal(retry.inserted, 19); assert.equal(api.writeBatches.length, 2); api.db.close();
  });
  await test("batch failure leaves no automatic repeat and exposes no provider values", async () => {
    const api = apiFixture({ failBatch: true }); const baseline = await targetBaseline(api);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true })), (error) => /write result is unresolved/.test(error.message) && !error.message.includes(token));
    assert.equal(api.writeBatches.length, 1); assert.equal(api.db.prepare("SELECT COUNT(*) AS n FROM auth_attempts").get().n, 0); api.db.close();
  });
  await test("validated cache retention is explicit and survives every batch and final replan", async () => {
    const api = apiFixture({ cacheMetadata: true }); const baseline = await targetBaseline(api);
    const cacheOptions = { sourceDirectory: cacheSourceDirectory, sourcePauseProbe: async () => cacheSourceExport.report };
    await assert.rejects(applyDataPlan(callOptions(api, baseline, cacheOptions)), /Conflicting destination row/);
    const planned = await applyDataPlan(callOptions(api, baseline, { ...cacheOptions, retainValidatedCacheMetadata: true }));
    assert.equal(planned.planned, 65); assert.equal(planned.retainedMetadata, 2);
    const originalCache = api.db.prepare("SELECT * FROM workshop_google_places").get();
    const originalSeed = api.db.prepare("SELECT * FROM catalog_state").get();
    const result = await applyDataPlan(callOptions(api, baseline, { ...cacheOptions, retainValidatedCacheMetadata: true, execute: true }));
    assert.equal(result.inserted, 65); assert.equal(result.retainedMetadata, 2);
    assert.deepEqual(api.writeBatches.map((batch) => batch.length), [50, 15]);
    assert.deepEqual(api.db.prepare("SELECT * FROM workshop_google_places").get(), originalCache);
    assert.deepEqual(api.db.prepare("SELECT * FROM catalog_state").get(), originalSeed);
    assert(api.writeBatches.flat().every((statement) => !/workshop_google_places|catalog_state/.test(statement.sql)));
    const stored = JSON.parse(await readFile(join(cacheSourceDirectory, "snapshot.json"), "utf8"));
    assert.equal(stored.tables.find((table) => table.name === "workshop_google_places").rows[0].profile_hash, "0".repeat(64));
    api.db.close();
  });
  await test("cache retention never bypasses original source fingerprint verification", async () => {
    const api = apiFixture({ cacheMetadata: true }); const baseline = await targetBaseline(api);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { sourceDirectory: cacheSourceDirectory, retainValidatedCacheMetadata: true, execute: true, sourcePauseProbe: async () => ({ ...cacheSourceExport.report, dataFingerprint: "0".repeat(64) }) })), /Source snapshot changed/);
    assert.equal(api.writeBatches.length, 0); api.db.close();
  });
  await test("stale target identity hashes remain blocked despite the retention option", async () => {
    const api = apiFixture({ cacheMetadata: true });
    api.db.prepare("UPDATE workshop_google_places SET profile_hash=?").run("f".repeat(64));
    const baseline = await targetBaseline(api);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { sourceDirectory: cacheSourceDirectory, retainValidatedCacheMetadata: true, execute: true, sourcePauseProbe: async () => cacheSourceExport.report })), /Conflicting destination row/);
    assert.equal(api.writeBatches.length, 0); api.db.close();
  });
  await test("CLI rejects nonboolean retention flags and unknown options before any network request", async () => {
    for (const input of [{ retainValidatedCacheMetadata: "true" }, { retainValidatedCacheMetadata: true, arbitrarySql: "DELETE FROM visits" }]) {
      const result = spawnSync(process.execPath, ["scripts/import-d1.mjs"], { input: JSON.stringify(input), encoding: "utf8" });
      assert.equal(result.status, 1); assert.equal(result.stdout, "");
      assert.match(result.stderr, /Protected D1 transfer stopped/);
    }
  });
  await test("wrong account, database, token or release context never reaches the provider", async () => {
    let calls = 0; const request = async () => { calls++; throw new Error("Unexpected request"); };
    for (const extra of [{ accountId: "foreign" }, { databaseId: "foreign" }, { token: "short" }, { token: `${token}\n` }, { expectedCommit: "bad" }]) await assert.rejects(snapshotDestination({ token, expectedCommit, request, ...extra }), /destination|token/);
    assert.equal(calls, 0);
  });
  await test("forged checked migration SQL cannot execute locally or remotely", async () => {
    const api = apiFixture(); const baseline = await targetBaseline(api);
    const forged = structuredClone(migrations); forged[0].sql += " ATTACH '/private' AS stolen";
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true, migrations: forged })), /exact checked-in migration set/);
    assert.equal(api.writeBatches.length, 0); api.db.close();
  });
  await test("destination backup must be completed and exact before execution", async () => {
    const api = apiFixture(); const baseline = await targetBaseline(api);
    const directory = baselineDirectories.get(baseline);
    const verified = await loadVerifiedDestinationBackup({ directory, expectedCommit });
    assert.equal(verified.snapshot.projectId, d1Destination.databaseId);
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true, destinationDirectory: undefined })), /completed protected destination backup/);
    await assert.rejects(loadVerifiedDestinationBackup({ directory, expectedCommit: "c".repeat(40) }), /identity, completion or checksums/);
    const bytes = await readFile(join(directory, "snapshot.json"));
    await writeFile(join(directory, "snapshot.json"), bytes.toString() + " ");
    await assert.rejects(applyDataPlan(callOptions(api, baseline, { execute: true })), /identity, completion or checksums/);
    assert.equal(api.writeBatches.length, 0); api.db.close();
  });
  await test("source checksum tampering and wrong source identity block transfer", async () => {
    await assert.rejects(loadVerifiedSourceBackup({ directory: sourceDirectory, expectedProjectId: "foreign", expectedCommit: sourceCommit }), /identity, completion or checksums/);
    const bytes = await readFile(join(sourceDirectory, "snapshot.json"));
    await writeFile(join(sourceDirectory, "snapshot.json"), bytes.toString() + " ");
    await assert.rejects(loadVerifiedSourceBackup({ directory: sourceDirectory, expectedProjectId: sourceProjectId, expectedCommit: sourceCommit }), /identity, completion or checksums/);
    await writeFile(join(sourceDirectory, "snapshot.json"), bytes);
  });
} finally { await rm(parent, { recursive: true, force: true }); }
console.log(`${checks} protected D1 import checks passed.`);
