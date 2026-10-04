import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { loadMigrationSet, snapshotDatabase, planDataTransfer } from "../scripts/data-transfer.mjs";
import { destinationFingerprint, d1Destination, backupDestination, snapshotDestination } from "../scripts/import-d1.mjs";
import { exportSource } from "../scripts/export-source.mjs";
import { applyDeltaPlan, loadTransferredBaseline, loadExpiryProjection } from "../scripts/apply-delta-d1.mjs";

const migrations = await loadMigrationSet();
const sourceProjectId = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8")).project_id;
const root = await mkdtemp(join(tmpdir(), "riparim-domain-delta-fixture-"));
const token = "CLOUDFLARE_PRIVATE_FIXTURE_TOKEN_".repeat(2);
const sourceCommit = "a".repeat(40); const currentSourceCommit = "b".repeat(40); const oldTargetCommit = "d".repeat(40); const targetCommit = "c".repeat(40);
const baselineAt = "2020-01-01T12:00:00.000Z"; const currentAt = "2020-01-01T13:00:00.000Z";
let sequence = 0; let checks = 0;
const tableRows = (snapshot, name) => snapshot.tables.find((table) => table.name === name).rows;
function dbFixture() {
  const db = new DatabaseSync(":memory:"); for (const migration of migrations) db.exec(migration.sql);
  db.exec("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  for (const migration of migrations) db.prepare("INSERT INTO d1_migrations(name) VALUES(?)").run(migration.name);
  return db;
}
function sourceFixture() {
  const db = dbFixture();
  db.prepare("INSERT INTO auth_settings VALUES(?,?,?,?,?,?)").run("fixture", "https://fixture.supabase.co", "publishable-fixture", 1, 1, baselineAt);
  db.prepare("INSERT INTO auth_account_roles VALUES(?,?,?,?)").run("supabase:fixture:owner", "admin", baselineAt, "bootstrap-fixture");
  db.prepare("INSERT INTO auth_sessions(id,account_id,expires_at,created_at) VALUES(?,?,?,?)").run("session-fixture", "supabase:fixture:owner", 9999999999999, baselineAt);
  db.prepare("INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run("visit-fixture", "supabase:fixture:owner", "workshop-fixture", "2020-01-01", "fixture", "repair", "note", "published", baselineAt);
  const result = snapshotDatabase(db, { projectId: sourceProjectId, sourceCommit, exportedAt: baselineAt, excludedProviderTables: [] }); db.close(); return result;
}
async function backupSource(snapshot, directory, objects = []) {
  return exportSource({ origin: "https://source-fixture.example", token: "a".repeat(64), expectedProjectId: sourceProjectId, expectedCommit: snapshot.sourceCommit, directory,
    request: async (target, options) => {
      const url = new URL(target);
      if (options.method === "POST") { const item = objects.find((object) => object.key === JSON.parse(options.body).key); return new Response(item.content, { headers: { ETag: `"${item.etag}"`, "Content-Length": String(item.size) } }); }
      if (url.searchParams.get("operation") === "schema") return Response.json({ ...snapshot, tables: undefined, readOnly: true });
      if (url.searchParams.get("operation") === "objects") return Response.json({ objects: objects.map((item) => { const value = { ...item }; delete value.content; return value; }), cursor: null });
      const table = snapshot.tables.find((item) => item.name === url.searchParams.get("table")); const offset = Number(url.searchParams.get("offset"));
      return Response.json({ name: table.name, columns: table.columns, rows: table.rows.slice(offset, offset + 5), nextOffset: offset + 5 < table.rows.length ? offset + 5 : null });
    },
  });
}
function apiFixture(snapshot, { loseAck = false, race = false, driftAfterBatch = false } = {}) {
  const db = dbFixture();
  for (const table of snapshot.tables.filter((item) => !["d1_migrations", "sqlite_sequence"].includes(item.name))) {
    const columns = table.columns.map((column) => column.name);
    const insert = db.prepare(`INSERT INTO ${table.name} (${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`);
    for (const row of table.rows) insert.run(...columns.map((column) => row[column]));
  }
  db.exec("DELETE FROM d1_migrations");
  for (const row of tableRows(snapshot, "d1_migrations")) db.prepare("INSERT INTO d1_migrations(id,name,applied_at) VALUES(?,?,?)").run(row.id, row.name, row.applied_at);
  for (const row of tableRows(snapshot, "sqlite_sequence")) db.prepare("UPDATE sqlite_sequence SET seq=? WHERE name=?").run(row.seq, row.name);
  const batches = []; let lost = false;
  const request = async (endpoint, options) => {
    assert.equal(endpoint, `https://api.cloudflare.com/client/v4/accounts/${d1Destination.accountId}/d1/database/${d1Destination.databaseId}/query`);
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body); const write = Array.isArray(body.batch); const queries = write ? body.batch : [body];
    if (write) {
      assert(queries.length <= 50); batches.push(queries);
      if (race) db.prepare("UPDATE auth_sessions SET moderator=1").run();
    }
    const result = [];
    try {
      for (const query of queries) {
        if (write) { assert.match(query.sql, /^(INSERT|UPDATE|DELETE) /); const changed = db.prepare(query.sql).run(...query.params); result.push({ success: true, results: [], meta: { changes: Number(changed.changes) } }); }
        else result.push({ success: true, results: db.prepare(query.sql).all(...query.params).map((row) => ({ ...row })) });
      }
    } catch { return Response.json({ success: false, errors: [{ message: `PRIVATE-DIAGNOSTIC-${token}` }] }); }
    if (write && driftAfterBatch) db.prepare("INSERT INTO catalog_state VALUES(?,?)").run("unknown-target-drift-fixture", "foreign");
    if (write && loseAck && !lost) { lost = true; throw new Error(`PRIVATE-LOST-ACK-${token}`); }
    return Response.json({ success: true, result });
  };
  return { db, request, batches };
}
async function fixture({ expired = false } = {}) {
  const directory = join(root, `case-${++sequence}`); await (await import("node:fs/promises")).mkdir(directory, { mode: 0o700 });
  const source = sourceFixture();
  if (expired) tableRows(source, "auth_attempts").push(counter("2020-01-01T11:30:00.000Z", "a"));
  const baselineSourceDirectory = join(directory, "source-old"); const exported = await backupSource(source, baselineSourceDirectory);
  const preTarget = structuredClone(source); preTarget.projectId = d1Destination.databaseId; preTarget.sourceCommit = oldTargetCommit;
  tableRows(preTarget, "auth_sessions").splice(0);
  const preTransferTargetDirectory = join(directory, "target-pre"); await backupDestination(preTarget, preTransferTargetDirectory);
  const baselineTarget = structuredClone(source); baselineTarget.projectId = d1Destination.databaseId; baselineTarget.sourceCommit = oldTargetCommit;
  const transfer = planDataTransfer(source, preTarget, { migrations, retainValidatedCacheMetadata: true });
  const transferReportFile = join(directory, "transfer-report.json");
  await writeFile(transferReportFile, JSON.stringify({ sourceDirectory: baselineSourceDirectory, destinationDirectory: preTransferTargetDirectory, sourceCommit, expectedCommit: oldTargetCommit, sourceBackup: exported.report, result: { executed: true, inserted: transfer.statements.length, retainedMetadata: transfer.retainedMetadata, sourceCommit, destinationFingerprint: destinationFingerprint(baselineTarget) } }), { mode: 0o600 });
  return { directory, source, baselineTarget, baselineSourceDirectory, preTransferTargetDirectory, transferReportFile };
}
async function setup(state, source, target, extra = {}) {
  const sourceDirectory = join(state.directory, `source-current-${++sequence}`); const proof = await backupSource(source, sourceDirectory, extra.objects ?? []);
  const api = apiFixture(target, extra.api);
  const fresh = await snapshotDestination({ token, expectedCommit: targetCommit, request: api.request });
  fresh.exportedAt = target.exportedAt;
  const destinationDirectory = join(state.directory, `target-current-${++sequence}`); await backupDestination(fresh, destinationDirectory);
  const options = { token, expectedCommit: targetCommit, expectedSourceCommit: currentSourceCommit, baselineSourceDirectory: state.baselineSourceDirectory, preTransferTargetDirectory: state.preTransferTargetDirectory, transferReportFile: state.transferReportFile, sourceDirectory, destinationDirectory, request: api.request, sourcePauseProbe: async () => proof.report, readOnlyProbe: async (url) => { assert.equal(url, `${d1Destination.origin}/`); return new Response("maintenance fixture", { status: 503, headers: { "Cache-Control": "no-store", "X-Riparim-Migration-Read-Only": "true", "X-Riparim-Release-Commit": targetCommit } }); } };
  return { api, options, proof, fresh };
}
function current(state) { const source = structuredClone(state.source); source.sourceCommit = currentSourceCommit; source.exportedAt = currentAt; const target = structuredClone(state.baselineTarget); target.sourceCommit = targetCommit; target.exportedAt = currentAt; return { source, target }; }
function counter(at, digit) { const time = Date.parse(at); return { key: `${digit.repeat(64)}:${Math.floor(time / 600000)}`, attempts: 1, expires_at: time + 1200000 }; }
async function test(name, fn) { await fn(); checks++; console.log(`ok ${name}`); }
try {
  await test("default execution mode only plans a proven source delta", async () => {
    const state = await fixture(); const { source, target } = current(state); tableRows(source, "auth_sessions")[0].revoked = 1;
    const run = await setup(state, source, target); const result = await applyDeltaPlan(run.options);
    assert.equal(result.executed, false); assert.equal(result.planned, 1); assert.equal(run.api.batches.length, 0); run.api.db.close();
  });
  await test("authoritative revoke/delete/insert delta uses full CAS and final raw equality", async () => {
    const state = await fixture(); const { source, target } = current(state);
    tableRows(source, "auth_sessions")[0].revoked = 1; tableRows(source, "auth_account_roles").splice(0); tableRows(source, "visits").splice(0);
    tableRows(source, "auth_account_status").push({ account_id: "supabase:fixture:owner", status: "deleted", updated_at: currentAt });
    const run = await setup(state, source, target); const result = await applyDeltaPlan({ ...run.options, execute: true });
    assert.deepEqual(result.applied, { insert: 1, update: 1, delete: 2 });
    assert.equal(run.api.db.prepare("SELECT revoked FROM auth_sessions").get().revoked, 1);
    assert.equal(run.api.db.prepare("SELECT COUNT(*) AS n FROM auth_account_roles").get().n, 0);
    assert.equal(run.api.db.prepare("SELECT COUNT(*) AS n FROM visits").get().n, 0);
    const newDirectory = join(state.directory, "target-after"); await backupDestination(await snapshotDestination({ token, expectedCommit: targetCommit, request: run.api.request }), newDirectory);
    const retry = await applyDeltaPlan({ ...run.options, destinationDirectory: newDirectory, execute: true });
    assert.deepEqual(retry.applied, { insert: 0, update: 0, delete: 0 }); run.api.db.close();
  });
  await test("lost acknowledgement does not retry and a fresh three-way replay resumes safely", async () => {
    const state = await fixture(); const { source, target } = current(state); tableRows(source, "auth_sessions")[0].revoked = 1;
    for (let index = 0; index < 65; index++) tableRows(source, "catalog_state").push({ key: `delta-fixture-${index}`, value: "fixture" });
    const run = await setup(state, source, target, { api: { loseAck: true } });
    await assert.rejects(applyDeltaPlan({ ...run.options, execute: true }), (error) => /acknowledgement failed/.test(error.message) && !error.message.includes(token));
    assert.equal(run.api.batches.length, 1);
    const directory = join(state.directory, "after-unacknowledged"); await backupDestination(await snapshotDestination({ token, expectedCommit: targetCommit, request: run.api.request }), directory);
    const result = await applyDeltaPlan({ ...run.options, destinationDirectory: directory, execute: true });
    assert.equal(result.applied.insert, 16); assert.equal(result.applied.update, 0); assert.equal(run.api.batches.length, 2); run.api.db.close();
  });
  await test("raced full-row CAS reports zero changes and cannot revoke another state", async () => {
    const state = await fixture(); const { source, target } = current(state); tableRows(source, "auth_sessions")[0].revoked = 1;
    const run = await setup(state, source, target, { api: { race: true } });
    await assert.rejects(applyDeltaPlan({ ...run.options, execute: true }), /compare-and-swap/);
    assert.equal(run.api.db.prepare("SELECT revoked FROM auth_sessions").get().revoked, 0); run.api.db.close();
  });
  await test("unknown target drift and maintenance/source-proof failures produce no writes", async () => {
    const state = await fixture(); const { source, target } = current(state); tableRows(source, "auth_sessions")[0].revoked = 1;
    for (const extra of [{ sourcePauseProbe: undefined }, { sourcePauseProbe: async () => ({ ...source, readOnly: false }) }, { readOnlyProbe: async () => new Response("outage", { status: 503 }) }]) {
      const run = await setup(state, source, target);
      await assert.rejects(applyDeltaPlan({ ...run.options, ...extra, execute: true }), /maintenance|source changed|released target/);
      assert.equal(run.api.batches.length, 0); run.api.db.close();
    }
    tableRows(target, "auth_sessions")[0].moderator = 1;
    const run = await setup(state, source, target); await assert.rejects(applyDeltaPlan({ ...run.options, execute: true }), /Unexpected target drift/); assert.equal(run.api.batches.length, 0); run.api.db.close();
  });
  await test("private evidence delta is a No-Go before any D1 mutation", async () => {
    const state = await fixture(); const { source, target } = current(state);
    tableRows(source, "visits")[0].file_key = "private/fixture-evidence";
    const content = Buffer.from("isolated evidence fixture");
    const object = { key: "private/fixture-evidence", size: content.length, etag: "fixture-etag", uploaded: currentAt, httpMetadata: { contentType: "image/png" }, customMetadata: {}, checksums: { sha256: createHash("sha256").update(content).digest("hex") }, content };
    const run = await setup(state, source, target, { objects: [object] });
    await assert.rejects(applyDeltaPlan({ ...run.options, execute: true }), /verified R2 delta is required/); assert.equal(run.api.batches.length, 0); run.api.db.close();
  });
  await test("QA receipt binds a fixed expired projection and keeps raw counters without cleanup", async () => {
    const state = await fixture({ expired: true }); const { source, target } = current(state);
    tableRows(target, "auth_attempts").splice(0, 1, counter("2020-01-01T12:10:00.000Z", "b"));
    tableRows(source, "auth_attempts").push(counter("2020-01-01T12:50:00.000Z", "c"));
    const run = await setup(state, source, target);
    const receiptFile = join(state.directory, "qa-receipt.json");
    const receipt = { readOnly: true, baselineRows: 1, currentRows: 1, allOriginalExpiredAtCurrentSnapshot: true, allAddedValidCounterKeys: true, allAddedWindowsRecordedInQaLedger: true, allAddedLastWritesWithinQaPeriod: true, allAddedExpiryWindowsMatchLimiter: true, allAddedExpiredAtCurrentSnapshot: true, allSyntheticActorsRemoved: true, activeSharedCountersMustBePreserved: true, liveCleanupPerformed: false, expiredCountersRestored: false, ipIdentityProven: false };
    await writeFile(receiptFile, JSON.stringify(receipt), { mode: 0o600 });
    const expiryProjection = { witnessDirectory: run.options.destinationDirectory, expectedWitnessCommit: targetCommit, receiptFile };
    const baseline = await loadTransferredBaseline({ ...run.options, migrations });
    const proof = await loadExpiryProjection(expiryProjection, baseline); assert.equal(proof.cutoff, currentAt); assert.equal(proof.ipIdentityProven, false);
    const result = await applyDeltaPlan({ ...run.options, expiryProjection, execute: true });
    assert.deepEqual(result.applied, { insert: 1, update: 0, delete: 0 });
    assert.equal(run.api.db.prepare("SELECT COUNT(*) AS n FROM auth_attempts").get().n, 2);
    assert(run.api.db.prepare("SELECT key FROM auth_attempts").all().some((row) => row.key === tableRows(target, "auth_attempts")[0].key));
    assert(!run.api.db.prepare("SELECT key FROM auth_attempts").all().some((row) => row.key === tableRows(state.source, "auth_attempts")[0].key));
    const nextDirectory = join(state.directory, "after-expiry"); await backupDestination(await snapshotDestination({ token, expectedCommit: targetCommit, request: run.api.request }), nextDirectory);
    const retry = await applyDeltaPlan({ ...run.options, destinationDirectory: nextDirectory, expiryProjection, execute: true }); assert.deepEqual(retry.applied, { insert: 0, update: 0, delete: 0 });
    receipt.allAddedWindowsRecordedInQaLedger = false; await writeFile(receiptFile, JSON.stringify(receipt));
    await assert.rejects(loadExpiryProjection(expiryProjection, baseline), /Recorded QA receipt/); run.api.db.close();
  });
  await test("source changes before final success cannot be concealed by successful mutations", async () => {
    const state = await fixture(); const { source, target } = current(state); tableRows(source, "auth_sessions")[0].revoked = 1;
    const run = await setup(state, source, target); let probes = 0;
    await assert.rejects(applyDeltaPlan({ ...run.options, execute: true, sourcePauseProbe: async () => ({ ...run.proof.report, dataFingerprint: ++probes >= 3 ? "0".repeat(64) : run.proof.report.dataFingerprint }) }), /Delta source changed/);
    assert.equal(run.api.batches.length, 1); run.api.db.close();
  });
  await test("a tampered completed report or wrong source project fails before any writer call", async () => {
    const state = await fixture(); const { source, target } = current(state); const run = await setup(state, source, target);
    await assert.rejects(applyDeltaPlan({ ...run.options, expectedSourceProjectId: "foreign-project", execute: true }), /fixed source Sites project/);
    const audit = JSON.parse(await readFile(state.transferReportFile, "utf8")); audit.result.destinationFingerprint = "0".repeat(64); await writeFile(state.transferReportFile, JSON.stringify(audit));
    await assert.rejects(applyDeltaPlan({ ...run.options, execute: true }), /completed fingerprint/); assert.equal(run.api.batches.length, 0); run.api.db.close();
  });
} finally { await rm(root, { recursive: true, force: true }); }
console.log(`${checks} protected delta execution checks passed.`);
