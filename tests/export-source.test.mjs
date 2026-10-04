import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportSource } from "../scripts/export-source.mjs";

const token = "f".repeat(64);
const commit = "a".repeat(40);
const metadata = { format: 1, projectId: "source-fixture", sourceCommit: commit, readOnly: true, exportedAt: "2026-10-04T20:00:00Z", excludedProviderTables: ["_cf_KV"] };
const columns = [
  { name: "id", type: "TEXT", notnull: 1, dflt_value: null, pk: 1 },
  { name: "owner", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "file_key", type: "TEXT", notnull: 0, dflt_value: null, pk: 0 },
];
const rows = Array.from({ length: 7 }, (_, index) => ({ id: `visit-${index}`, owner: `private-fixture-owner-${index}`, file_key: index === 0 ? "private/receipt-fixture.png" : null }));
const content = [Buffer.from("private isolated evidence fixture"), Buffer.from("orphan fixture"), Buffer.from([0, 1, 128, 255])];
const initialObjects = content.map((bytes, index) => ({
  key: index === 0 ? "private/receipt-fixture.png" : index === 1 ? "../escape-fixture" : "/absolute-fixture",
  size: bytes.length, etag: `etag-fixture-${index}`, uploaded: "2026-10-04T19:00:00Z",
  httpMetadata: { contentType: "image/png", contentDisposition: `attachment; filename=\"private-fixture-${index}.png\"`, cacheExpiry: "2026-10-05T00:00:00Z" },
  customMetadata: { owner: `private-fixture-owner-${index}`, purpose: "isolated test" },
  checksums: { sha256: createHash("sha256").update(bytes).digest("base64") },
}));
const providerColumns = [{ name: "key", type: "TEXT", notnull: 1, dflt_value: null, pk: 1 }, { name: "value", type: "BLOB", notnull: 0, dflt_value: null, pk: 0 }];
function fixture({ schemaChange = false, identityChange = false, rowChange = false, objectChange = false, stale = false, interrupted = false, malformed = null, readOnly = true } = {}) {
  const calls = [];
  let schemaReads = 0;
  let objectReads = 0;
  const schema = [
    { name: "visits", type: "table", tbl_name: "visits", sql: "CREATE TABLE visits(id TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,file_key TEXT)" },
    { name: "blob_fixture", type: "table", tbl_name: "blob_fixture", sql: "CREATE TABLE blob_fixture(key TEXT PRIMARY KEY NOT NULL,value BLOB)" },
  ];
  const request = async (target, options) => {
    const url = new URL(target);
    assert.equal(url.origin, "https://source-fixture.example");
    assert.equal(url.pathname, "/__migration/export");
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, "error");
    assert(!url.href.includes("private/receipt") && !url.href.includes("escape-fixture") && !url.href.includes(token), "private object keys and tokens stay out of request URLs");
    const operation = url.searchParams.get("operation");
    calls.push({ method: options.method, operation, table: url.searchParams.get("table"), offset: url.searchParams.get("offset"), cursor: url.searchParams.get("cursor") });
    if (options.method === "POST") {
      assert.equal(options.headers["Content-Type"], "application/json");
      const value = JSON.parse(options.body);
      assert.equal(value.operation, "object");
      assert.deepEqual(Object.keys(value).sort(), ["etag", "key", "operation"]);
      const index = initialObjects.findIndex((object) => object.key === value.key);
      assert.equal(value.etag, initialObjects[index].etag);
      if (stale) return Response.json({ error: "PRIVATE-PROVIDER-DIAGNOSTIC" }, { status: 409 });
      const body = interrupted ? new ReadableStream({
        start(controller) { controller.enqueue(content[index].subarray(0, 4)); },
        pull(controller) { controller.error(new Error(`PRIVATE-STREAM-FAILURE-${token}`)); },
      }) : content[index];
      return new Response(body, { headers: { ETag: `"${initialObjects[index].etag}"`, "Content-Length": String(malformed === "length" ? content[index].length + 1 : content[index].length) } });
    }
    if (operation === "schema") {
      schemaReads++;
      return Response.json({ ...metadata, readOnly, exportedAt: schemaReads === 1 ? metadata.exportedAt : "2026-10-04T20:01:00Z", sourceCommit: identityChange && schemaReads > 1 ? "b".repeat(40) : commit, schema: schemaChange && schemaReads > 1 ? [...schema, { name: "late_index", type: "index", tbl_name: "visits", sql: "CREATE INDEX late_index ON visits(owner)" }] : schema });
    }
    if (operation === "table") {
      const name = url.searchParams.get("table");
      const offset = Number(url.searchParams.get("offset"));
      if (name === "blob_fixture") return Response.json({ name, columns: providerColumns, rows: [{ key: "fixture", value: { type: "blob", base64: "AAGA/w==" } }], nextOffset: null });
      const tableRows = structuredClone(rows);
      if (rowChange && schemaReads > 1) tableRows[0].owner = "changed-private-owner-fixture";
      const page = tableRows.slice(offset, offset + 5);
      const fields = structuredClone(columns);
      if (malformed === "columns" && offset > 0) fields[0].type = "INTEGER";
      if (malformed === "scalar") page[0].owner = true;
      return Response.json({ name, columns: fields, rows: page, nextOffset: malformed === "offset" ? offset : offset + 5 < tableRows.length ? offset + 5 : null });
    }
    if (operation === "objects") {
      const cursor = url.searchParams.get("cursor");
      if (cursor === null) objectReads++;
      const objects = structuredClone(initialObjects);
      if (objectChange && objectReads > 1) objects[0].customMetadata.purpose = "changed";
      if (malformed === "duplicate") objects[1].key = objects[0].key;
      if (malformed === "checksum") objects.forEach((object) => { object.checksums.sha256 = "0".repeat(64); });
      if (malformed === "missing-reference") objects.shift();
      return Response.json({ objects: cursor === null ? objects.slice(0, 2) : objects.slice(2), cursor: malformed === "cursor" ? "repeating-cursor" : cursor === null && objects.length > 2 ? "fixture-cursor" : null });
    }
    throw new Error("Unexpected fixture request");
  };
  return { calls, request };
}
const parent = await mkdtemp(join(tmpdir(), "riparim-source-export-fixture-"));
let sequence = 0;
let checks = 0;
const options = (extra = {}) => ({ origin: "https://source-fixture.example", token, expectedProjectId: metadata.projectId, expectedCommit: commit, directory: join(parent, `backup-${++sequence}`), ...extra });
async function test(name, fn) { await fn(); checks++; console.log(`ok ${name}`); }
async function incomplete(input, pattern) {
  await assert.rejects(exportSource(input), (error) => pattern.test(error.message) && !error.message.includes(token) && !error.message.includes("private-fixture-owner") && !error.message.includes("PRIVATE-PROVIDER"));
  await assert.rejects(stat(join(input.directory, "complete.json")), { code: "ENOENT" });
}
try {
  await test("downloads every table/object page and rechecks exact paused source data", async () => {
    const fake = fixture();
    const input = options({ request: fake.request });
    const result = await exportSource(input);
    assert.equal(result.report.complete, true);
    assert.deepEqual(result.snapshot.excludedProviderTables, ["_cf_KV"]);
    assert.deepEqual(result.report.excludedProviderTables, ["_cf_KV"]);
    assert(!fake.calls.some((call) => call.table === "_cf_KV"));
    assert.equal(result.report.rows, 8);
    assert.equal(result.report.tables, 2);
    assert.equal(result.report.objects, 3);
    assert.equal(result.report.bytes, content.reduce((sum, bytes) => sum + bytes.length, 0));
    assert.equal(result.snapshot.tables.find((table) => table.name === "visits").rows.length, 7);
    assert.deepEqual(result.snapshot.tables.find((table) => table.name === "blob_fixture").rows[0].value, { type: "blob", base64: "AAGA/w==" });
    assert.equal(fake.calls.filter((call) => call.operation === "table" && call.table === "visits").length, 4);
    assert.equal(fake.calls.filter((call) => call.operation === "objects").length, 4);
    assert.equal(fake.calls.filter((call) => call.operation === "schema").length, 2);
    const stored = JSON.parse(await readFile(join(input.directory, "manifest.json"), "utf8"));
    for (const object of stored.objects) {
      const index = initialObjects.findIndex((item) => item.key === object.key);
      assert.deepEqual(object.httpMetadata, initialObjects[index].httpMetadata);
      assert.deepEqual(object.customMetadata, initialObjects[index].customMetadata);
      assert.deepEqual(object.checksums, initialObjects[index].checksums);
      assert.match(object.file, /^objects\/[a-f0-9]{64}\.bin$/);
      assert.deepEqual(await readFile(join(input.directory, object.file)), content[index]);
      assert.equal((await stat(join(input.directory, object.file))).mode & 0o777, 0o600);
    }
    assert.equal((await stat(input.directory)).mode & 0o777, 0o700);
    assert.equal((await stat(join(input.directory, "objects"))).mode & 0o777, 0o700);
    for (const file of ["snapshot.json", "manifest.json", "complete.json"]) {
      const bytes = await readFile(join(input.directory, file));
      assert(!bytes.toString().includes(token));
      assert.equal((await stat(join(input.directory, file))).mode & 0o777, 0o600);
    }
    assert.equal(createHash("sha256").update(await readFile(join(input.directory, "snapshot.json"))).digest("hex"), result.report.snapshotSha256);
    assert.equal(createHash("sha256").update(await readFile(join(input.directory, "manifest.json"))).digest("hex"), result.report.manifestSha256);
  });
  await test("reserved provider tables cannot be requested through a malformed envelope", async () => {
    const request = async () => Response.json({ ...metadata, schema: [{ name: "_cf_KV", type: "table", tbl_name: "_cf_KV", sql: "CREATE TABLE _cf_KV(key TEXT PRIMARY KEY,value BLOB)" }] });
    await incomplete(options({ request }), /schema inventory is invalid/);
  });
  await test("stale ETags block object download and completed markers", async () => { const fake = fixture({ stale: true }); await incomplete(options({ request: fake.request }), /object changed/); });
  await test("interrupted streams preserve protected partial files without completion", async () => {
    const fake = fixture({ interrupted: true }); const input = options({ request: fake.request });
    await incomplete(input, /object stream.*incomplete/);
    const files = await readdir(join(input.directory, "objects"));
    assert(files.some((file) => file.endsWith(".partial")));
    assert(!files.some((file) => file.endsWith(".bin")));
  });
  for (const [name, change, pattern] of [
    ["late database row changes", "rowChange", /database changed/],
    ["late schema changes", "schemaChange", /database changed/],
    ["late source commit changes", "identityChange", /identity, released commit/],
    ["late evidence metadata changes", "objectChange", /evidence inventory changed/],
  ]) await test(`${name} reject completion`, async () => { const fake = fixture({ [change]: true }); await incomplete(options({ request: fake.request }), pattern); });
  for (const [name, pattern] of [
    ["offset", /pagination is invalid/], ["columns", /columns changed/], ["scalar", /SQLite scalar row/],
    ["duplicate", /evidence inventory is invalid/], ["cursor", /pagination did not progress/],
    ["length", /metadata changed during download/], ["checksum", /checksum does not match/], ["missing-reference", /Referenced evidence is missing/],
  ]) await test(`malformed ${name} blocks a complete backup`, async () => { const fake = fixture({ malformed: name }); await incomplete(options({ request: fake.request }), pattern); });
  await test("false read-only state is rejected before directory creation", async () => { const fake = fixture({ readOnly: false }); await incomplete(options({ request: fake.request }), /read-only state/); });
  await test("exact expected project and released commit are mandatory", async () => {
    const fake = fixture();
    await incomplete(options({ expectedProjectId: "foreign-fixture", request: fake.request }), /identity, released commit/);
    await incomplete(options({ expectedCommit: "b".repeat(40), request: fake.request }), /identity, released commit/);
  });
  await test("origins, credentials and paths fail before any provider request", async () => {
    let requests = 0;
    const request = () => { requests++; throw new Error("Unexpected fixture call"); };
    for (const origin of ["http://source-fixture.example", "https://user:password@source-fixture.example", "https://source-fixture.example/path", "https://source-fixture.example/?query=1", "https://source-fixture.example/#fragment", "invalid"]) await incomplete(options({ origin, request }), /HTTPS|origin/);
    for (const value of ["", "bad", "A".repeat(64), "a".repeat(63)]) await incomplete(options({ token: value, request }), /protected export credential/);
    await assert.rejects(exportSource(options({ directory: "relative/backup", request })), /absolute, new protected/);
    assert.equal(requests, 0);
  });
  await test("existing backup directory is never resumed or overwritten", async () => {
    const fake = fixture(); const input = options({ request: fake.request });
    await mkdir(input.directory); await writeFile(join(input.directory, "existing.txt"), "protected old backup");
    await incomplete(input, /must be new/);
    assert.equal(await readFile(join(input.directory, "existing.txt"), "utf8"), "protected old backup");
  });
  await test("provider failures expose only operation/status, never response or token", async () => {
    await incomplete(options({ request: async () => Response.json({ error: `PRIVATE-PROVIDER-DIAGNOSTIC-${token}` }, { status: 404 }) }), /schema request failed \(HTTP 404\)/);
    await incomplete(options({ request: async () => { throw new Error(`PRIVATE-PROVIDER-DIAGNOSTIC-${token}`); } }), /schema request failed/);
  });
} finally { await rm(parent, { recursive: true, force: true }); }
console.log(`${checks} protected source export checks passed.`);
