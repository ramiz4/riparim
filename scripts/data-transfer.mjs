import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { workshopIdentityInput } from "../lib/google-identity-fingerprint.mjs";

const historyNames = new Set(["__drizzle_migrations", "d1_migrations", "__appgarden_migrations"]);
const schemaTypes = new Set(["table", "index", "trigger", "view"]);
const blob = (value) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 2 && value.type === "blob" && typeof value.base64 === "string" && Buffer.from(value.base64, "base64").toString("base64") === value.base64;
const scalar = (value) => value === null || typeof value === "string" || blob(value) || (typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)));
const decode = (value) => blob(value) ? Buffer.from(value.base64, "base64") : value;
const encode = (value) => value instanceof Uint8Array ? { type: "blob", base64: Buffer.from(value).toString("base64") } : value;
const archiveName = (name) => historyNames.has(name) || name === "sqlite_sequence" || name.startsWith("_cf_");
const identifier = (value) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
const quote = (value) => { if (!identifier(value)) throw new Error("Invalid SQLite identifier in snapshot."); return `"${value}"`; };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message) => { throw new Error(message); };

// Compare the complete SQLite definitions, including constraints and indexes.
// Formatting outside string literals is immaterial; literal contents stay exact.
function normalizedSql(sql) {
  return sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s]/g)?.map((token) => {
    if (token.startsWith("'")) return token;
    if (/^["`\[]/.test(token)) return token.slice(1, -1).toLowerCase();
    return token.toLowerCase();
  }).filter((token) => token !== ";").join("\u0000") ?? "";
}

function applicationSchema(snapshot) {
  return snapshot.schema.filter((item) => !archiveName(item.tbl_name))
    .map((item) => ({ name: item.name, type: item.type, table: item.tbl_name, sql: normalizedSql(item.sql) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function columnsShape(columns) {
  return columns.map(({ name, type, notnull, dflt_value, pk }) => ({ name, type: type.toUpperCase(), notnull: Number(notnull), dflt_value, pk: Number(pk) }));
}

export function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== 1 || typeof snapshot.projectId !== "string" || !snapshot.projectId || !/^[a-f0-9]{40,64}$/.test(snapshot.sourceCommit ?? "") || !Number.isFinite(Date.parse(snapshot.exportedAt)) || !Array.isArray(snapshot.schema) || !Array.isArray(snapshot.tables)) fail("Invalid snapshot envelope.");
  const names = new Set();
  for (const item of snapshot.schema) {
    if (!item || !identifier(item.name) || !identifier(item.tbl_name) || !schemaTypes.has(item.type) || typeof item.sql !== "string" || !item.sql || names.has(item.name)) fail("Invalid or duplicate schema object.");
    names.add(item.name);
  }
  const tables = new Set();
  for (const table of snapshot.tables) {
    if (!table || !identifier(table.name) || tables.has(table.name) || !Array.isArray(table.columns) || !table.columns.length || !Array.isArray(table.rows)) fail("Invalid or duplicate snapshot table.");
    tables.add(table.name);
    const columns = new Set();
    for (const column of table.columns) {
      if (!column || !identifier(column.name) || columns.has(column.name) || typeof column.type !== "string" || !/^[A-Za-z0-9_ ()]*$/.test(column.type) || ![0, 1].includes(Number(column.notnull)) || !Number.isInteger(Number(column.pk)) || Number(column.pk) < 0 || !(column.dflt_value === null || typeof column.dflt_value === "string")) fail("Invalid snapshot column contract.");
      columns.add(column.name);
    }
    for (const row of table.rows) {
      if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length !== columns.size || Object.keys(row).some((name) => !columns.has(name)) || Object.values(row).some((value) => !scalar(value))) fail(`Invalid SQLite scalar row in table ${table.name}.`);
    }
  }
  const declared = snapshot.schema.filter((item) => item.type === "table").map((item) => item.name);
  if (declared.length !== tables.size || declared.some((name) => !tables.has(name))) fail("Schema/table inventory is incomplete.");
  return snapshot;
}

export async function loadMigrationSet(root = fileURLToPath(new URL("../", import.meta.url))) {
  const journal = JSON.parse(await readFile(join(root, "drizzle/meta/_journal.json"), "utf8"));
  if (journal.dialect !== "sqlite" || !Array.isArray(journal.entries)) fail("Invalid checked-in migration journal.");
  const entries = [];
  for (const [idx, entry] of journal.entries.entries()) {
    if (entry.idx !== idx || !/^\d{4}_[a-z0-9_]+$/.test(entry.tag) || !Number.isSafeInteger(entry.when)) fail("Invalid migration ordering.");
    const sql = await readFile(join(root, "drizzle", `${entry.tag}.sql`), "utf8");
    entries.push({ name: `${entry.tag}.sql`, when: entry.when, sql, sha256: hash(sql) });
  }
  return entries;
}

export function snapshotDatabase(database, metadata) {
  const schema = database.prepare("SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name").all().map((item) => ({ ...item }));
  const tables = schema.filter((item) => item.type === "table").map(({ name }) => ({
    name,
    columns: database.prepare(`PRAGMA table_info(${quote(name)})`).all().map(({ name: column, type, notnull, dflt_value, pk }) => ({ name: column, type, notnull, dflt_value, pk })),
    rows: database.prepare(`SELECT * FROM ${quote(name)}`).all().map((row) => Object.fromEntries(Object.entries(row).map(([column, value]) => [column, encode(value)]))),
  }));
  return validateSnapshot({ format: 1, ...metadata, schema, tables });
}

function checkedPrefix(snapshot, migrations) {
  validateSnapshot(snapshot);
  const expected = new DatabaseSync(":memory:");
  const matches = [];
  try {
    for (let count = 0; count <= migrations.length; count++) {
      const candidate = snapshotDatabase(expected, snapshot);
      if (JSON.stringify(applicationSchema(snapshot)) === JSON.stringify(applicationSchema(candidate))) {
        const actualTables = snapshot.tables.filter((item) => !archiveName(item.name));
        if (actualTables.length === candidate.tables.filter((item) => !archiveName(item.name)).length && actualTables.every((table) => {
          const match = candidate.tables.find((item) => item.name === table.name);
          return match && JSON.stringify(columnsShape(table.columns)) === JSON.stringify(columnsShape(match.columns));
        })) matches.push(count);
      }
      if (count < migrations.length) expected.exec(migrations[count].sql);
    }
  } finally { expected.close(); }
  if (matches.length !== 1) fail("Source schema does not match one unique checked-in migration prefix.");
  const prefix = matches[0];
  const history = snapshot.tables.filter((item) => historyNames.has(item.name));
  for (const table of history) {
    if (table.name === "__appgarden_migrations") {
      // OpenAI Sites records these same ordered migration filenames in a known
      // provider table. Accept this exact alias, never an arbitrary name prefix.
      const expectedSql = 'CREATE TABLE "__appgarden_migrations"(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)';
      const expectedColumns = [
        { name: "id", type: "INTEGER", notnull: 0, dflt_value: null, pk: 1 },
        { name: "name", type: "TEXT", notnull: 0, dflt_value: null, pk: 0 },
        { name: "applied_at", type: "TIMESTAMP", notnull: 1, dflt_value: "CURRENT_TIMESTAMP", pk: 0 },
      ];
      const definition = snapshot.schema.find((item) => item.name === table.name && item.type === "table");
      if (!definition || normalizedSql(definition.sql) !== normalizedSql(expectedSql) || JSON.stringify(columnsShape(table.columns)) !== JSON.stringify(expectedColumns)) fail("Sites migration history schema does not match its verified provider contract.");
    }
    if (table.rows.length !== prefix) fail("Migration history length does not match schema.");
    if (table.name === "d1_migrations" || table.name === "__appgarden_migrations") {
      const rows = [...table.rows].sort((a, b) => Number(a.id) - Number(b.id));
      if (new Set(rows.map((row) => row.id)).size !== rows.length || rows.some((row, index) => !Number.isSafeInteger(row.id) || row.id < 1 || row.name !== migrations[index].name)) fail("Filename migration history does not match checked-in migrations.");
    } else {
      // SQLite Drizzle uses SERIAL, which permits a null id. Its ordered
      // timestamps and file hashes, rather than that optional id, prove history.
      const rows = [...table.rows].sort((a, b) => Number(a.created_at) - Number(b.created_at));
      if (rows.some((row, index) => row.hash !== migrations[index].sha256 || Number(row.created_at) !== migrations[index].when)) fail("Drizzle migration history does not match checked-in migrations.");
    }
  }
  return { count: prefix, history: history.map((table) => table.name), historyAbsent: history.length === 0 };
}

// Execute only trusted checked-in migration SQL, never SQL from an exported
// database. Even a malformed source definition cannot ATTACH a local file.
export function restoreSnapshot(snapshot, migrations) {
  const proof = checkedPrefix(snapshot, migrations);
  const database = new DatabaseSync(":memory:");
  try {
    for (const migration of migrations.slice(0, proof.count)) database.exec(migration.sql);
    database.exec("BEGIN");
    try {
      for (const table of snapshot.tables.filter((item) => !archiveName(item.name))) {
        const columns = table.columns.map((column) => column.name);
        const statement = database.prepare(`INSERT INTO ${quote(table.name)} (${columns.map(quote).join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
        for (const row of table.rows) statement.run(...columns.map((column) => decode(row[column])));
      }
      database.exec("COMMIT");
    } catch { database.exec("ROLLBACK"); fail("Snapshot rows violate the checked-in schema; restore stopped."); }
    return { database, proof, sourceHistory: snapshot.tables.filter((item) => historyNames.has(item.name)).map((table) => structuredClone(table)), sourceArchive: { schema: snapshot.schema.filter((item) => archiveName(item.tbl_name)).map((item) => structuredClone(item)), tables: snapshot.tables.filter((item) => archiveName(item.name)).map((item) => structuredClone(item)) } };
  } catch (error) { database.close(); throw error; }
}

export function upgradeSnapshot(snapshot, migrations) {
  const restored = restoreSnapshot(snapshot, migrations);
  try {
    for (const migration of migrations.slice(restored.proof.count)) restored.database.exec(migration.sql);
    const upgraded = snapshotDatabase(restored.database, {
      projectId: snapshot.projectId, sourceCommit: snapshot.sourceCommit, exportedAt: snapshot.exportedAt,
    });
    return { snapshot: upgraded, proof: { ...restored.proof, applied: migrations.slice(restored.proof.count).map((migration) => migration.name) }, sourceHistory: restored.sourceHistory, sourceArchive: restored.sourceArchive };
  } catch { fail("Source upgrade failed; no destination changes were made."); }
  finally { restored.database.close(); }
}

function sameRow(left, right) {
  return left !== undefined && right !== undefined && Object.keys(left).length === Object.keys(right).length && Object.keys(left).every((column) => Object.hasOwn(right, column) && JSON.stringify(left[column]) === JSON.stringify(right[column]));
}
function isoTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}
export function retainCacheMetadata(table, row, match, source, target) {
  const sourceWorkshops = source.tables.find((item) => item.name === "workshops")?.rows ?? [];
  const targetWorkshops = target.tables.find((item) => item.name === "workshops")?.rows ?? [];
  if (table.name === "catalog_state") {
    return /^workshop-source:[a-f0-9]{64}$/.test(row.key) && row.key === match.key && isoTimestamp(row.value) && isoTimestamp(match.value) && sourceWorkshops.length === targetWorkshops.length && sourceWorkshops.every((workshop) => sameRow(workshop, targetWorkshops.find((item) => item.id === workshop.id)));
  }
  if (table.name !== "workshop_google_places" || row.workshop_id !== match.workshop_id || row.place_id !== match.place_id || !/^[a-f0-9]{64}$/.test(row.profile_hash) || !/^[a-f0-9]{64}$/.test(match.profile_hash) || [row.checked_at, row.retry_after, match.checked_at, match.retry_after].some((value) => !Number.isSafeInteger(value) || value < 0)) return false;
  const different = table.columns.filter((column) => JSON.stringify(row[column.name]) !== JSON.stringify(match[column.name])).map((column) => column.name);
  if (different.some((column) => !["checked_at", "retry_after", "profile_hash"].includes(column))) return false;
  const workshop = sourceWorkshops.find((item) => item.id === row.workshop_id);
  if (!workshop || !sameRow(workshop, targetWorkshops.find((item) => item.id === row.workshop_id))) return false;
  const sourceRating = source.tables.find((item) => item.name === "workshop_google_ratings")?.rows.find((item) => item.workshop_id === row.workshop_id);
  const targetRating = target.tables.find((item) => item.name === "workshop_google_ratings")?.rows.find((item) => item.workshop_id === row.workshop_id);
  if (!(sourceRating === undefined && targetRating === undefined) && !sameRow(sourceRating, targetRating)) return false;
  const lat = workshop.lat === null ? null : Number(workshop.lat);
  const lng = workshop.lng === null ? null : Number(workshop.lng);
  if ((lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) return false;
  const input = workshopIdentityInput({ name: workshop.name, phone: workshop.phone, city: workshop.city, address: workshop.address, lat, lng, googleRating: sourceRating ? { mapsUrl: sourceRating.maps_url } : null });
  return match.profile_hash === hash(input);
}

export function planDataTransfer(source, target, { migrations, retainValidatedCacheMetadata = false } = {}) {
  if (!Array.isArray(migrations) || !migrations.length) fail("Checked-in migrations are required for transfer planning.");
  const upgraded = upgradeSnapshot(source, migrations);
  const restoredTarget = restoreSnapshot(target, migrations);
  try {
    if (restoredTarget.proof.count !== migrations.length) fail("Destination must have every checked-in migration applied.");
    const statements = [];
    const summary = [];
    restoredTarget.database.exec("BEGIN");
    for (const table of upgraded.snapshot.tables) {
      const existing = target.tables.find((item) => item.name === table.name);
      const columns = table.columns.map((column) => column.name);
      const primaryKey = table.columns.filter((column) => column.pk).sort((a, b) => a.pk - b.pk).map((column) => column.name);
      if (!existing || !primaryKey.length) fail(`Table ${table.name} requires an exact destination schema and primary key.`);
      const key = (row) => JSON.stringify(primaryKey.map((column) => row[column]));
      const index = new Map();
      for (const row of existing.rows) { if (index.has(key(row))) fail(`Duplicate destination primary key in table ${table.name}.`); index.set(key(row), row); }
      const seen = new Set();
      let unchanged = 0;
      let retainedMetadata = 0;
      let insert = 0;
      for (const row of table.rows) {
        const identity = key(row);
        if (seen.has(identity)) fail(`Duplicate source primary key in table ${table.name}.`);
        seen.add(identity);
        const match = index.get(identity);
        if (match) {
          if (columns.some((column) => JSON.stringify(match[column]) !== JSON.stringify(row[column]))) {
            if (retainValidatedCacheMetadata !== true || !retainCacheMetadata(table, row, match, upgraded.snapshot, target)) fail(`Conflicting destination row in table ${table.name}; no writes planned.`);
            retainedMetadata++;
          } else unchanged++;
        } else {
          const sql = `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
          const params = columns.map((column) => row[column]);
          try { restoredTarget.database.prepare(sql).run(...params.map(decode)); }
          catch { fail(`Destination constraint conflict in table ${table.name}; no writes planned.`); }
          statements.push({ table: table.name, sql, params });
          insert++;
        }
      }
      summary.push({ table: table.name, source: table.rows.length, destination: existing.rows.length, insert, unchanged, retainedMetadata, destinationOnly: [...index.keys()].filter((identity) => !seen.has(identity)).length });
    }
    if (restoredTarget.database.prepare("PRAGMA foreign_key_check").all().length) fail("Destination foreign-key validation failed.");
    restoredTarget.database.exec("ROLLBACK");
    return { format: 1, sourceCommit: source.sourceCommit, sourceProjectId: source.projectId, targetProjectId: target.projectId, sourceProof: upgraded.proof, sourceHistory: upgraded.sourceHistory, sourceArchive: upgraded.sourceArchive, destinationHistory: restoredTarget.proof, retainedMetadata: summary.reduce((sum, table) => sum + table.retainedMetadata, 0), summary, statements };
  } finally { restoredTarget.database.close(); }
}

function metadataObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((entry) => typeof entry === "string");
}

export function validateEvidenceManifest(snapshot, manifest) {
  validateSnapshot(snapshot);
  if (!manifest || manifest.format !== 1 || manifest.projectId !== snapshot.projectId || !Number.isFinite(Date.parse(manifest.exportedAt)) || !Array.isArray(manifest.objects)) fail("Invalid evidence manifest envelope.");
  const keys = new Set();
  const files = new Set();
  for (const object of manifest.objects) {
    if (!object || typeof object.key !== "string" || !object.key || object.key.length > 1024 || /[\u0000-\u001f\u007f]/.test(object.key) || keys.has(object.key) || typeof object.file !== "string" || !object.file || object.file.startsWith("/") || /[\\:\u0000-\u001f\u007f]/.test(object.file) || object.file.split("/").some((part) => !part || part === "." || part === "..") || files.has(object.file) || !/^[a-f0-9]{64}$/.test(object.sha256 ?? "") || !Number.isSafeInteger(object.size) || object.size < 0 || !metadataObject(object.httpMetadata) || !metadataObject(object.customMetadata)) fail("Invalid or duplicate evidence object metadata.");
    keys.add(object.key); files.add(object.file);
  }
  let referenced = 0;
  for (const name of ["visits", "evidence_uploads"]) {
    for (const row of snapshot.tables.find((table) => table.name === name)?.rows ?? []) {
      if (row.file_key !== null && row.file_key !== undefined) {
        if (typeof row.file_key !== "string" || !keys.has(row.file_key)) fail(`Referenced evidence is missing from the manifest (${name}).`);
        referenced++;
      }
    }
  }
  return { objects: keys.size, references: referenced, unreferenced: [...keys].filter((key) => !snapshot.tables.some((table) => ["visits", "evidence_uploads"].includes(table.name) && table.rows.some((row) => row.file_key === key))).length };
}

export async function verifyEvidenceFiles(manifest, directory) {
  const base = await realpath(directory);
  let bytes = 0;
  for (const object of manifest.objects) {
    // Validation is independent of platform path semantics (including Windows
    // drive names). Symlinks cannot escape the protected export directory.
    if (typeof object.file !== "string" || !object.file || object.file.startsWith("/") || /[\\:\u0000-\u001f\u007f]/.test(object.file) || object.file.split("/").some((part) => !part || part === "." || part === "..")) fail("Unsafe evidence export path.");
    let file;
    try { file = await realpath(resolve(base, object.file)); }
    catch { fail("An evidence export file is missing."); }
    const offset = relative(base, file);
    if (!offset || offset === ".." || offset.startsWith(`..${sep}`)) fail("Evidence export file escapes its protected directory.");
    const info = await stat(file);
    if (!info.isFile() || info.size !== object.size) fail("Evidence export checksum or size mismatch.");
    const checksum = createHash("sha256");
    for await (const chunk of createReadStream(file)) checksum.update(chunk);
    if (checksum.digest("hex") !== object.sha256) fail("Evidence export checksum or size mismatch.");
    bytes += info.size;
    if (!Number.isSafeInteger(bytes)) fail("Evidence export size exceeds exact numeric accounting.");
  }
  return { objects: manifest.objects.length, bytes };
}
