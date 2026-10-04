import { randomUUID, createHash } from "node:crypto";
import { mkdir, open, readFile, lstat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMigrationSet, planDataTransfer, validateSnapshot, validateEvidenceManifest, verifyEvidenceFiles } from "./data-transfer.mjs";
import { exportSource } from "./export-source.mjs";

export const d1Destination = Object.freeze({ accountId: "ec181b3a61c7c3da13910600953fc3ea", databaseId: "b395ea3a-5316-4b0b-bdee-533bdb68d6a0", origin: "https://riparim.riparim-ec181b.workers.dev" });
const fail = (message) => { throw new Error(message); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = (value) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
const quote = (value) => { if (!identifier(value)) fail("Invalid destination identifier."); return `"${value}"`; };
function canonical(value) { return Array.isArray(value) ? value.map(canonical) : record(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value; }
const fingerprint = (value) => hash(JSON.stringify(canonical(value)));
const sourceFingerprint = (snapshot) => fingerprint({ excludedProviderTables: snapshot.excludedProviderTables, schema: [...snapshot.schema].sort((a, b) => a.name.localeCompare(b.name)), tables: [...snapshot.tables].sort((a, b) => a.name.localeCompare(b.name)) });
export const destinationFingerprint = (snapshot) => fingerprint({ excludedProviderTables: snapshot.excludedProviderTables, schema: [...snapshot.schema].sort((a, b) => a.name.localeCompare(b.name)), tables: snapshot.tables.map((table) => ({ ...table, rows: [...table.rows].sort((a, b) => fingerprint(a).localeCompare(fingerprint(b))) })).sort((a, b) => a.name.localeCompare(b.name)) });

function context({ token, expectedCommit, accountId = d1Destination.accountId, databaseId = d1Destination.databaseId }) {
  if (accountId !== d1Destination.accountId || databaseId !== d1Destination.databaseId || !/^[a-f0-9]{40}$/.test(expectedCommit ?? "")) fail("Exact production destination and released commit are required.");
  if (typeof token !== "string" || token.length < 20 || token.length > 512 || /[^\x21-\x7e]/.test(token)) fail("A protected Cloudflare token is required.");
}
export function queryClient(options) {
  context(options);
  const request = options.request ?? fetch;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${d1Destination.accountId}/d1/database/${d1Destination.databaseId}/query`;
  return async (queries, write = false) => {
    const batch = Array.isArray(queries) ? queries : [queries];
    if (!batch.length || batch.length > 50) fail("D1 query batch must contain at most 50 statements.");
    let response;
    let envelope;
    try {
      response = await request(endpoint, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${options.token}`, "Content-Type": "application/json" }, body: JSON.stringify(write ? { batch } : batch[0]), signal: AbortSignal.timeout(120_000) });
      envelope = await response.json();
    } catch { fail(write ? "D1 write acknowledgement failed. Refresh the destination and replan before retrying." : "D1 destination read failed."); }
    if (!response.ok || !record(envelope) || envelope.success !== true || !Array.isArray(envelope.result) || envelope.result.length !== batch.length || envelope.result.some((item) => !record(item) || item.success !== true || !Array.isArray(item.results))) fail(write ? "D1 write result is unresolved. Refresh the destination and replan before retrying." : "D1 destination read failed.");
    return envelope.result;
  };
}
function encode(value) {
  if (Array.isArray(value) && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return { type: "blob", base64: Buffer.from(value).toString("base64") };
  return value;
}

export async function snapshotDestination(options = {}) {
  const query = queryClient(options);
  const inventory = (await query({ sql: "SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND type IN ('table','index','trigger','view') ORDER BY name", params: [] }))[0].results;
  if (inventory.some((item) => !record(item) || !identifier(item.name) || !identifier(item.tbl_name))) fail("Invalid destination schema inventory.");
  const excludedProviderTables = inventory.filter((item) => item.type === "table" && item.name.startsWith("_cf_")).map((item) => item.name).sort();
  const schema = inventory.filter((item) => !item.tbl_name.startsWith("_cf_"));
  const tables = [];
  for (const item of schema.filter((entry) => entry.type === "table")) {
    const columns = (await query({ sql: `PRAGMA table_info(${quote(item.name)})`, params: [] }))[0].results.map(({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull, dflt_value, pk }));
    if (!columns.length || columns.some((column) => !identifier(column.name))) fail("Invalid destination column inventory.");
    const keys = columns.filter((column) => column.pk).sort((a, b) => a.pk - b.pk);
    const order = keys.length ? keys.map((column) => quote(column.name)).join(",") : "rowid";
    const rows = [];
    let offset = 0;
    while (true) {
      const page = (await query({ sql: `SELECT * FROM ${quote(item.name)} ORDER BY ${order} LIMIT ? OFFSET ?`, params: [5, offset] }))[0].results;
      if (page.length > 5) fail("Invalid destination pagination.");
      rows.push(...page.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, encode(value)]))));
      if (page.length < 5) break;
      offset += 5;
    }
    tables.push({ name: item.name, columns, rows });
  }
  const lastInventory = (await query({ sql: "SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND type IN ('table','index','trigger','view') ORDER BY name", params: [] }))[0].results;
  if (fingerprint(inventory) !== fingerprint(lastInventory)) fail("Destination schema changed while being read.");
  return validateSnapshot({ format: 1, projectId: d1Destination.databaseId, sourceCommit: options.expectedCommit, exportedAt: new Date().toISOString(), excludedProviderTables, schema, tables });
}

async function protectedFile(path) {
  const info = await lstat(path);
  if (!info.isFile() || (info.mode & 0o077) !== 0) fail("Backup files must be private regular files.");
  return readFile(path);
}
export async function loadVerifiedSourceBackup({ directory, expectedProjectId, expectedCommit }) {
  if (!isAbsolute(directory ?? "")) fail("An absolute protected source backup directory is required.");
  const info = await lstat(directory);
  if (!info.isDirectory() || (info.mode & 0o077) !== 0) fail("Source backup directory must be private.");
  let report;
  let snapshot;
  let manifest;
  const snapshotBytes = await protectedFile(join(directory, "snapshot.json"));
  const manifestBytes = await protectedFile(join(directory, "manifest.json"));
  try { report = JSON.parse(await protectedFile(join(directory, "complete.json"))); snapshot = JSON.parse(snapshotBytes); manifest = JSON.parse(manifestBytes); }
  catch { fail("A completed protected source backup is required."); }
  if (report.format !== 1 || report.complete !== true || report.readOnly !== true || report.sourceProjectId !== expectedProjectId || report.sourceCommit !== expectedCommit || report.snapshotSha256 !== hash(snapshotBytes) || report.manifestSha256 !== hash(manifestBytes) || snapshot.projectId !== expectedProjectId || snapshot.sourceCommit !== expectedCommit || report.exportedAt !== snapshot.exportedAt || manifest.exportedAt !== snapshot.exportedAt) fail("Source backup identity, completion or checksums do not match.");
  validateSnapshot(snapshot);
  validateEvidenceManifest(snapshot, manifest);
  if (report.dataFingerprint !== sourceFingerprint(snapshot) || report.objectsFingerprint !== fingerprint(manifest.objects.map((object) => { const metadata = { ...object }; delete metadata.file; delete metadata.sha256; return metadata; }).sort((a, b) => a.key.localeCompare(b.key)))) fail("Source backup fingerprints do not match.");
  await verifyEvidenceFiles(manifest, directory);
  return { snapshot, manifest, report };
}
async function writeProtected(path, content) {
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
}
export async function backupDestination(snapshot, directory) {
  validateSnapshot(snapshot);
  if (snapshot.projectId !== d1Destination.databaseId || !isAbsolute(directory ?? "")) fail("Exact destination and an absolute new backup directory are required.");
  try { await mkdir(directory, { mode: 0o700 }); } catch { fail("Destination backup directory must be new."); }
  const bytes = JSON.stringify(snapshot);
  await writeProtected(join(directory, "snapshot.json"), bytes);
  const report = { format: 1, complete: true, destination: d1Destination, sourceCommit: snapshot.sourceCommit, snapshotSha256: hash(bytes), dataFingerprint: destinationFingerprint(snapshot), excludedProviderTables: snapshot.excludedProviderTables, tables: snapshot.tables.length, rows: snapshot.tables.reduce((sum, table) => sum + table.rows.length, 0) };
  await writeProtected(join(directory, "complete.json"), JSON.stringify(report));
  return report;
}

export async function loadVerifiedDestinationBackup({ directory, expectedCommit }) {
  if (!isAbsolute(directory ?? "")) fail("An absolute protected destination backup directory is required.");
  const info = await lstat(directory);
  if (!info.isDirectory() || (info.mode & 0o077) !== 0) fail("Destination backup directory must be private.");
  const bytes = await protectedFile(join(directory, "snapshot.json"));
  let report; let snapshot;
  try { report = JSON.parse(await protectedFile(join(directory, "complete.json"))); snapshot = JSON.parse(bytes); }
  catch { fail("A completed protected destination backup is required."); }
  validateSnapshot(snapshot);
  if (report.format !== 1 || report.complete !== true || report.destination?.accountId !== d1Destination.accountId || report.destination?.databaseId !== d1Destination.databaseId || report.destination?.origin !== d1Destination.origin || snapshot.projectId !== d1Destination.databaseId || snapshot.sourceCommit !== expectedCommit || report.sourceCommit !== expectedCommit || report.snapshotSha256 !== hash(bytes) || report.dataFingerprint !== destinationFingerprint(snapshot)) fail("Destination backup identity, completion or checksums do not match.");
  return { snapshot, report };
}

export async function applyDataPlan({ token, expectedCommit, sourceDirectory, expectedSourceProjectId, expectedSourceCommit, expectedDestinationSnapshot, destinationDirectory, migrations, retainValidatedCacheMetadata = false, execute = false, request = fetch, readOnlyProbe = fetch, sourcePauseProbe, accountId, databaseId } = {}) {
  const options = { token, expectedCommit, request, accountId, databaseId };
  context(options);
  const source = await loadVerifiedSourceBackup({ directory: sourceDirectory, expectedProjectId: expectedSourceProjectId, expectedCommit: expectedSourceCommit });
  if (destinationDirectory) {
    const verified = await loadVerifiedDestinationBackup({ directory: destinationDirectory, expectedCommit });
    if (expectedDestinationSnapshot && destinationFingerprint(expectedDestinationSnapshot) !== destinationFingerprint(verified.snapshot)) fail("Destination baseline does not match its protected backup.");
    expectedDestinationSnapshot = verified.snapshot;
  } else if (execute === true) fail("A completed protected destination backup is required for execution.");
  if (!expectedDestinationSnapshot || expectedDestinationSnapshot.projectId !== d1Destination.databaseId || expectedDestinationSnapshot.sourceCommit !== expectedCommit) fail("The exact protected destination baseline is required.");
  validateSnapshot(expectedDestinationSnapshot);
  const checkedMigrations = await loadMigrationSet();
  if (migrations && fingerprint(migrations) !== fingerprint(checkedMigrations)) fail("Only the exact checked-in migration set may be used.");
  const initial = await snapshotDestination(options);
  if (destinationFingerprint(initial) !== destinationFingerprint(expectedDestinationSnapshot)) fail("Destination changed since its backup. Take a fresh backup and replan.");
  const initialPlan = planDataTransfer(source.snapshot, initial, { migrations: checkedMigrations, retainValidatedCacheMetadata });
  if (execute !== true) return { executed: false, planned: initialPlan.statements.length, retainedMetadata: initialPlan.retainedMetadata, summary: initialPlan.summary };
  if (typeof sourcePauseProbe !== "function") fail("An authenticated source pause and fingerprint verifier is required for execution.");
  async function verifyPause() {
    let proof;
    let target;
    try { proof = await sourcePauseProbe(); target = await readOnlyProbe(`${d1Destination.origin}/`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(15_000) }); }
    catch { fail("Source or destination maintenance could not be verified; transfer stopped."); }
    if (!proof || proof.readOnly !== true || proof.sourceProjectId !== expectedSourceProjectId || proof.sourceCommit !== expectedSourceCommit || proof.dataFingerprint !== source.report.dataFingerprint || proof.objectsFingerprint !== source.report.objectsFingerprint || target.status !== 503 || target.headers.get("X-Riparim-Migration-Read-Only") !== "true" || target.headers.get("X-Riparim-Release-Commit") !== expectedCommit || !(target.headers.get("Cache-Control") ?? "").split(",").some((directive) => directive.trim().toLowerCase() === "no-store")) fail("Source snapshot changed or maintenance is not active; transfer stopped.");
  }
  const query = queryClient(options);
  let expected = initial;
  let inserted = 0;
  while (true) {
    await verifyPause();
    const current = await snapshotDestination(options);
    if (destinationFingerprint(current) !== destinationFingerprint(expected)) fail("Destination changed before the next transfer batch; take a fresh backup and replan.");
    const plan = planDataTransfer(source.snapshot, current, { migrations: checkedMigrations, retainValidatedCacheMetadata });
    if (!plan.statements.length) break;
    const chunk = plan.statements.slice(0, 50);
    if (chunk.some((statement) => statement.params.some((value) => typeof value === "object" && value !== null))) fail("Application BLOB bindings need a separately verified REST encoding; transfer stopped.");
    // SQL and bindings come only from a fresh schema-proven source reconciliation.
    // There is no caller-supplied SQL, replacement, upsert, or acknowledgement retry.
    await query(chunk.map(({ sql, params }) => ({ sql, params })), true);
    expected = structuredClone(current);
    for (const statement of chunk) {
      const table = expected.tables.find((item) => item.name === statement.table);
      table.rows.push(Object.fromEntries(table.columns.map((column, index) => [column.name, statement.params[index]])));
    }
    inserted += chunk.length;
  }
  await verifyPause();
  const final = await snapshotDestination(options);
  if (destinationFingerprint(final) !== destinationFingerprint(expected)) fail("Destination final verification failed; keep both systems paused and reconcile.");
  const finalPlan = planDataTransfer(source.snapshot, final, { migrations: checkedMigrations, retainValidatedCacheMetadata });
  if (finalPlan.statements.length) fail("Destination does not yet contain every source row.");
  return { executed: true, inserted, retainedMetadata: finalPlan.retainedMetadata, summary: finalPlan.summary, destinationFingerprint: destinationFingerprint(final), sourceCommit: expectedSourceCommit };
}

async function runCli() {
  let input = "";
  for await (const chunk of process.stdin) { input += chunk; if (Buffer.byteLength(input) > 32_768) fail("Protected transfer input is too large."); }
  const options = JSON.parse(input);
  const allowed = new Set(["token", "expectedCommit", "accountId", "databaseId", "sourceDirectory", "expectedSourceProjectId", "expectedSourceCommit", "destinationBackupDirectory", "execute", "sourceOrigin", "sourceToken", "sourceProbeParent", "retainValidatedCacheMetadata"]);
  if (!record(options) || Object.keys(options).some((key) => !allowed.has(key)) || (options.retainValidatedCacheMetadata !== undefined && typeof options.retainValidatedCacheMetadata !== "boolean")) fail("Protected transfer options are required on stdin.");
  const target = await snapshotDestination(options);
  const backup = await backupDestination(target, options.destinationBackupDirectory);
  if (!options.sourceDirectory) { console.log(JSON.stringify({ ...backup, destination: undefined })); return; }
  let sourcePauseProbe;
  if (options.execute === true) {
    if (!isAbsolute(options.sourceProbeParent ?? "")) fail("A protected source probe parent is required for execution.");
    sourcePauseProbe = async () => (await exportSource({ origin: options.sourceOrigin, token: options.sourceToken, expectedProjectId: options.expectedSourceProjectId, expectedCommit: options.expectedSourceCommit, directory: join(options.sourceProbeParent, `pause-${randomUUID()}`) })).report;
  }
  const result = await applyDataPlan({ ...options, expectedDestinationSnapshot: target, destinationDirectory: options.destinationBackupDirectory, sourcePauseProbe });
  console.log(JSON.stringify(result));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runCli(); }
  catch { console.error("Protected D1 transfer stopped. Keep maintenance active, inspect the protected backups and take a fresh destination snapshot before retrying."); process.exitCode = 1; }
}
