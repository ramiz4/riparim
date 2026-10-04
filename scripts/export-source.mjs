import { createHash } from "node:crypto";
import { mkdir, open, rename } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvidenceManifest, validateSnapshot } from "./data-transfer.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message) => { throw new Error(message); };
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = (value) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
const stringMap = (value) => record(value) && Object.values(value).every((item) => typeof item === "string");
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const fingerprint = (value) => sha256(JSON.stringify(canonical(value)));
async function writeProtected(path, content) {
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(content); await handle.sync(); }
  finally { await handle.close(); }
}
function snapshotFingerprint(snapshot) {
  return fingerprint({ excludedProviderTables: snapshot.excludedProviderTables, schema: [...snapshot.schema].sort((a, b) => a.name.localeCompare(b.name)), tables: [...snapshot.tables].sort((a, b) => a.name.localeCompare(b.name)) });
}

export async function exportSource({ origin, token, expectedProjectId, expectedCommit, directory, request = fetch } = {}) {
  let base;
  try { base = new URL(origin); } catch { fail("A valid source HTTPS origin is required."); }
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) fail("Source origin must be HTTPS with no credentials, path, query or fragment.");
  if (!/^[a-f0-9]{64}$/.test(token ?? "")) fail("A valid protected export credential is required.");
  if (typeof expectedProjectId !== "string" || !expectedProjectId || expectedProjectId.length > 128 || /[\u0000-\u001f\u007f]/.test(expectedProjectId) || !/^[a-f0-9]{40}$/.test(expectedCommit ?? "")) fail("Exact source project and released commit are required.");
  if (typeof directory !== "string" || !isAbsolute(directory)) fail("An absolute, new protected backup directory is required.");
  const endpoint = new URL("/__migration/export", base);
  const headers = { Authorization: `Bearer ${token}`, "Accept-Encoding": "identity" };
  async function fetchResponse(url, options, operation) {
    let response;
    try { response = await request(url, { ...options, headers: { ...headers, ...options?.headers }, redirect: "error", signal: AbortSignal.timeout(120_000) }); }
    catch { fail(`Source ${operation} request failed; backup is incomplete.`); }
    if (response.status === 409) fail("Source object changed during export; backup is incomplete.");
    if (!response.ok) fail(`Source ${operation} request failed (HTTP ${response.status}); backup is incomplete.`);
    return response;
  }
  async function json(operation, parameters = {}) {
    const url = new URL(endpoint);
    url.searchParams.set("operation", operation);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));
    const response = await fetchResponse(url, { method: "GET" }, operation);
    try { return await response.json(); }
    catch { fail(`Source ${operation} response is invalid; backup is incomplete.`); }
  }
  function checkSchema(envelope) {
    if (!record(envelope) || envelope.format !== 1 || envelope.readOnly !== true || envelope.projectId !== expectedProjectId || envelope.sourceCommit !== expectedCommit || !Number.isFinite(Date.parse(envelope.exportedAt)) || !Array.isArray(envelope.schema) || !Array.isArray(envelope.excludedProviderTables) || new Set(envelope.excludedProviderTables).size !== envelope.excludedProviderTables.length || envelope.excludedProviderTables.some((name) => !identifier(name) || !name.startsWith("_cf_"))) fail("Source identity, released commit or read-only state could not be verified.");
    const names = new Set();
    for (const item of envelope.schema) {
      if (!record(item) || !identifier(item.name) || !identifier(item.tbl_name) || item.tbl_name.startsWith("_cf_") || !["table", "index", "trigger", "view"].includes(item.type) || typeof item.sql !== "string" || !item.sql || names.has(item.name)) fail("Source schema inventory is invalid.");
      names.add(item.name);
    }
    return envelope;
  }
  async function readSnapshot(envelope) {
    const tables = [];
    for (const schema of envelope.schema.filter((item) => item.type === "table").sort((a, b) => a.name.localeCompare(b.name))) {
      let offset = 0;
      let columns;
      const rows = [];
      while (true) {
        const page = await json("table", { table: schema.name, offset });
        if (!record(page) || page.name !== schema.name || !Array.isArray(page.columns) || !Array.isArray(page.rows) || page.rows.length > 5 || !(page.nextOffset === null || (Number.isSafeInteger(page.nextOffset) && page.nextOffset === offset + page.rows.length && page.nextOffset > offset))) fail("Source table pagination is invalid.");
        if (columns && fingerprint(columns) !== fingerprint(page.columns)) fail("Source columns changed during export; backup is incomplete.");
        columns ??= page.columns;
        rows.push(...page.rows);
        if (page.nextOffset === null) break;
        offset = page.nextOffset;
      }
      tables.push({ name: schema.name, columns, rows });
    }
    return validateSnapshot({ format: 1, projectId: envelope.projectId, sourceCommit: envelope.sourceCommit, exportedAt: envelope.exportedAt, excludedProviderTables: [...envelope.excludedProviderTables].sort(), schema: envelope.schema, tables });
  }
  async function readObjects() {
    const objects = [];
    const keys = new Set();
    const cursors = new Set();
    let cursor;
    while (true) {
      const page = await json("objects", cursor === undefined ? {} : { cursor });
      if (!record(page) || !Array.isArray(page.objects) || page.objects.length > 100 || !(page.cursor === null || (typeof page.cursor === "string" && page.cursor && page.cursor.length <= 4096))) fail("Source object pagination is invalid.");
      for (const object of page.objects) {
        if (!record(object) || typeof object.key !== "string" || !object.key || Buffer.byteLength(object.key) > 1024 || /[\u0000-\u001f\u007f]/.test(object.key) || keys.has(object.key) || !Number.isSafeInteger(object.size) || object.size < 0 || typeof object.etag !== "string" || !object.etag || /[\u0000-\u001f\u007f]/.test(object.etag) || !Number.isFinite(Date.parse(object.uploaded)) || !stringMap(object.httpMetadata) || !stringMap(object.customMetadata) || !stringMap(object.checksums)) fail("Source evidence inventory is invalid.");
        keys.add(object.key); objects.push(object);
      }
      if (page.cursor === null) break;
      if (cursors.has(page.cursor) || page.objects.length === 0) fail("Source object pagination did not progress.");
      cursors.add(page.cursor); cursor = page.cursor;
    }
    return objects.sort((a, b) => a.key.localeCompare(b.key));
  }

  // Each attempt has a unique directory. We do not resume partially downloaded
  // private objects without a fresh verified source snapshot and metadata proof.
  const initialEnvelope = checkSchema(await json("schema"));
  try { await mkdir(directory, { mode: 0o700 }); }
  catch { fail("Backup directory must be new and have an existing protected parent."); }
  await mkdir(join(directory, "objects"), { mode: 0o700 });
  const snapshot = await readSnapshot(initialEnvelope);
  const snapshotBytes = JSON.stringify(snapshot);
  await writeProtected(join(directory, "snapshot.json"), snapshotBytes);
  const sourceObjects = await readObjects();
  const objects = [];
  let bytes = 0;
  for (const object of sourceObjects) {
    const file = `objects/${sha256(object.key)}.bin`;
    const temporary = join(directory, `${file}.partial`);
    const response = await fetchResponse(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "object", key: object.key, etag: object.etag }),
    }, "object");
    const etag = response.headers.get("ETag");
    if (![object.etag, `"${object.etag}"`].includes(etag) || response.headers.get("Content-Length") !== String(object.size) || (!response.body && object.size !== 0)) fail("Source object metadata changed during download; backup is incomplete.");
    const handle = await open(temporary, "wx", 0o600);
    let size = 0;
    const checksum = createHash("sha256");
    try {
      if (response.body) for await (const chunk of response.body) {
        if (!(chunk instanceof Uint8Array)) fail("Source object stream is invalid; backup is incomplete.");
        size += chunk.byteLength;
        if (!Number.isSafeInteger(size) || size > object.size) fail("Source object size changed during download; backup is incomplete.");
        checksum.update(chunk);
        // FileHandle.write may perform a partial write; account for every byte.
        let written = 0;
        while (written < chunk.byteLength) {
          const result = await handle.write(chunk, written, chunk.byteLength - written);
          if (!result.bytesWritten) fail("Protected object backup write failed.");
          written += result.bytesWritten;
        }
      }
      await handle.sync();
    } catch { fail("Source object stream or protected backup write failed; backup is incomplete."); }
    finally { await handle.close(); }
    const digest = checksum.digest("hex");
    if (size !== object.size) fail("Source object size changed during download; backup is incomplete.");
    if (object.checksums.sha256 && ![digest, Buffer.from(digest, "hex").toString("base64")].includes(object.checksums.sha256)) fail("Source object checksum does not match; backup is incomplete.");
    await rename(temporary, join(directory, file));
    objects.push({ ...object, file, sha256: digest });
    bytes += size;
    if (!Number.isSafeInteger(bytes)) fail("Backup size exceeds exact numeric accounting.");
  }
  const finalSnapshot = await readSnapshot(checkSchema(await json("schema")));
  const dataFingerprint = snapshotFingerprint(snapshot);
  if (dataFingerprint !== snapshotFingerprint(finalSnapshot)) fail("Source database changed during export; backup is incomplete.");
  const objectsFingerprint = fingerprint(sourceObjects);
  if (objectsFingerprint !== fingerprint(await readObjects())) fail("Source evidence inventory changed during export; backup is incomplete.");
  const manifest = { format: 1, projectId: expectedProjectId, exportedAt: initialEnvelope.exportedAt, objects };
  const references = validateEvidenceManifest(snapshot, manifest);
  const manifestBytes = JSON.stringify(manifest);
  await writeProtected(join(directory, "manifest.json"), manifestBytes);
  const report = {
    format: 1, complete: true, sourceProjectId: expectedProjectId, sourceCommit: expectedCommit,
    exportedAt: initialEnvelope.exportedAt, completedAt: new Date().toISOString(), readOnly: true,
    excludedProviderTables: snapshot.excludedProviderTables, snapshotSha256: sha256(snapshotBytes), manifestSha256: sha256(manifestBytes), dataFingerprint, objectsFingerprint,
    tables: snapshot.tables.length, rows: snapshot.tables.reduce((sum, table) => sum + table.rows.length, 0), objects: objects.length, bytes, references,
  };
  await writeProtected(join(directory, ".complete.partial"), JSON.stringify(report));
  await rename(join(directory, ".complete.partial"), join(directory, "complete.json"));
  const directoryHandle = await open(directory, "r");
  try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
  return { snapshot, manifest, report };
}

async function runCli() {
  // Credentials never appear in argv, output files or normal command logs.
  let input = "";
  for await (const chunk of process.stdin) { input += chunk; if (Buffer.byteLength(input) > 16_384) fail("Protected export input is too large."); }
  let options;
  try { options = JSON.parse(input); } catch { fail("Supply protected export options as JSON on stdin."); }
  if (!record(options) || Object.keys(options).some((key) => !["origin", "token", "expectedProjectId", "expectedCommit", "directory"].includes(key))) fail("Protected export options are invalid.");
  const { report } = await exportSource(options);
  console.log(JSON.stringify({ complete: true, tables: report.tables, rows: report.rows, objects: report.objects, bytes: report.bytes, excludedProviderTables: report.excludedProviderTables, snapshotSha256: report.snapshotSha256, manifestSha256: report.manifestSha256 }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runCli(); }
  catch { console.error("Protected source export failed. No complete backup was recorded; check configuration and source maintenance state."); process.exitCode = 1; }
}
