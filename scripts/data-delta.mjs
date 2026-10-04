import { createHash } from "node:crypto";
import { planDataTransfer, restoreSnapshot, upgradeSnapshot, retainCacheMetadata } from "./data-transfer.mjs";
import { destinationFingerprint } from "./import-d1.mjs";

const fail = (message) => { throw new Error(message); };
const hash = (value) => createHash("sha256").update(JSON.stringify(value) ?? "missing").digest("hex");
const sameRow = (left, right) => left === undefined && right === undefined || left !== undefined && right !== undefined && Object.keys(left).length === Object.keys(right).length && Object.keys(left).every((column) => Object.hasOwn(right, column) && JSON.stringify(left[column]) === JSON.stringify(right[column]));
const quote = (value) => { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) fail("Invalid delta identifier."); return `"${value}"`; };
const decode = (value) => value && typeof value === "object" && value.type === "blob" ? Buffer.from(value.base64, "base64") : value;
function rowKey(table, row) { const keys = table.columns.filter((column) => column.pk).sort((a, b) => a.pk - b.pk); if (!keys.length) fail(`Delta table ${table.name} requires a primary key.`); return JSON.stringify(keys.map((column) => row[column.name])); }
const indexRows = (table) => new Map(table.rows.map((row) => [rowKey(table, row), row]));

export function reconstructTransferredBaseline(source, preTarget, { migrations, expectedFingerprint, expectedInserted, expectedRetainedMetadata } = {}) {
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint ?? "")) fail("The completed transfer fingerprint is required.");
  const plan = planDataTransfer(source, preTarget, { migrations, retainValidatedCacheMetadata: true });
  if ((expectedInserted !== undefined && plan.statements.length !== expectedInserted) || (expectedRetainedMetadata !== undefined && plan.retainedMetadata !== expectedRetainedMetadata)) fail("Reconstructed transfer counts do not match its completed report.");
  const baseline = structuredClone(preTarget);
  for (const statement of plan.statements) {
    const table = baseline.tables.find((item) => item.name === statement.table);
    table.rows.push(Object.fromEntries(table.columns.map((column, index) => [column.name, statement.params[index]])));
  }
  if (destinationFingerprint(baseline) !== expectedFingerprint) fail("Reconstructed transfer baseline does not match its completed fingerprint.");
  return { snapshot: baseline, inserted: plan.statements.length, retainedMetadata: plan.retainedMetadata, fingerprint: expectedFingerprint };
}

export function compareSnapshotTables(expected, actual) {
  return [...new Set([...expected.tables.map((table) => table.name), ...actual.tables.map((table) => table.name)])].sort().flatMap((name) => {
    const left = expected.tables.find((table) => table.name === name);
    const right = actual.tables.find((table) => table.name === name);
    const ordered = (table) => table && { ...table, rows: [...table.rows].sort((a, b) => hash(a).localeCompare(hash(b))) };
    const expectedFingerprint = hash(ordered(left)); const actualFingerprint = hash(ordered(right));
    if (expectedFingerprint === actualFingerprint) return [];
    const key = (table, row) => table.columns.some((column) => column.pk) ? rowKey(table, row) : hash(row);
    const leftRows = new Map(left?.rows.map((row) => [key(left, row), row]) ?? []);
    const rightRows = new Map(right?.rows.map((row) => [key(right, row), row]) ?? []);
    return [{ table: name, expected: left?.rows.length ?? 0, actual: right?.rows.length ?? 0, added: [...rightRows.keys()].filter((id) => !leftRows.has(id)).length, removed: [...leftRows.keys()].filter((id) => !rightRows.has(id)).length, changed: [...leftRows.keys()].filter((id) => rightRows.has(id) && !sameRow(leftRows.get(id), rightRows.get(id))).length, expectedFingerprint, actualFingerprint }];
  });
}

function stableAuthProject(previous, current) {
  const settings = (snapshot) => snapshot.tables.find((table) => table.name === "auth_settings")?.rows.map((row) => [row.id, row.project_url]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) ?? [];
  if (JSON.stringify(settings(previous)) !== JSON.stringify(settings(current))) fail("Auth project identity changed; domain delta cannot migrate between providers.");
}

export function projectExpiredAuthAttempts(snapshot, { cutoff, trustedExecutorTime = new Date().toISOString() } = {}) {
  const at = Date.parse(cutoff); const executor = Date.parse(trustedExecutorTime);
  if (typeof cutoff !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff) || !Number.isFinite(at) || new Date(at).toISOString() !== cutoff || !Number.isFinite(executor) || at > executor) fail("Auth-attempt expiry cutoff must be fixed and no later than trusted execution time.");
  const projected = structuredClone(snapshot);
  const table = projected.tables.find((item) => item.name === "auth_attempts");
  if (!table) fail("Expiry projection requires the known auth-attempt table.");
  let expired = 0;
  table.rows = table.rows.filter((row) => {
    const match = typeof row.key === "string" && row.key.match(/^[a-f0-9]{64}:(0|[1-9]\d*)$/);
    const window = match ? Number(match[1]) : NaN;
    const start = (window + 2) * 600_000; const end = (window + 3) * 600_000;
    if (!match || !Number.isSafeInteger(window) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || !Number.isSafeInteger(row.attempts) || row.attempts < 1 || !Number.isSafeInteger(row.expires_at) || row.expires_at < start || row.expires_at >= end) fail("Auth-attempt rows do not match the runtime window and expiry contract.");
    if (row.expires_at < at) { expired++; return false; }
    return true;
  });
  return { snapshot: projected, expired };
}

export function planDataDelta(baselineSource, baselineTarget, currentSource, currentTarget, { migrations, expectedBaselineFingerprint, retainValidatedCacheMetadata = true, allowExpiredAuthAttemptsAt, trustedExecutorTime = new Date().toISOString() } = {}) {
  if (!/^[a-f0-9]{64}$/.test(expectedBaselineFingerprint ?? "") || destinationFingerprint(baselineTarget) !== expectedBaselineFingerprint) fail("The proven post-transfer baseline fingerprint is required.");
  if (baselineSource.projectId !== currentSource.projectId || baselineTarget.projectId !== currentTarget.projectId) fail("Delta source or target identity changed.");
  let original = upgradeSnapshot(baselineSource, migrations).snapshot;
  let source = upgradeSnapshot(currentSource, migrations).snapshot;
  let activeBaselineTarget = baselineTarget;
  let activeCurrentTarget = currentTarget;
  let sourceExpired = 0; let targetExpired = 0;
  if (allowExpiredAuthAttemptsAt !== undefined) {
    const cutoff = Date.parse(allowExpiredAuthAttemptsAt);
    if (cutoff > Date.parse(currentSource.exportedAt) || cutoff > Date.parse(currentTarget.exportedAt)) fail("Expiry cutoff must be witnessed by both fresh protected snapshots.");
    original = projectExpiredAuthAttempts(original, { cutoff: allowExpiredAuthAttemptsAt, trustedExecutorTime }).snapshot;
    const projectedSource = projectExpiredAuthAttempts(source, { cutoff: allowExpiredAuthAttemptsAt, trustedExecutorTime }); source = projectedSource.snapshot; sourceExpired = projectedSource.expired;
    activeBaselineTarget = projectExpiredAuthAttempts(baselineTarget, { cutoff: allowExpiredAuthAttemptsAt, trustedExecutorTime }).snapshot;
    const projectedTarget = projectExpiredAuthAttempts(currentTarget, { cutoff: allowExpiredAuthAttemptsAt, trustedExecutorTime }); activeCurrentTarget = projectedTarget.snapshot; targetExpired = projectedTarget.expired;
  }
  stableAuthProject(original, source);
  const targetProof = restoreSnapshot(currentTarget, migrations);
  const baselineProof = restoreSnapshot(baselineTarget, migrations);
  try {
    if (targetProof.proof.count !== migrations.length || baselineProof.proof.count !== migrations.length) fail("Delta target and baseline require the complete checked-in schema.");
    const baselineCopy = planDataTransfer(baselineSource, baselineTarget, { migrations, retainValidatedCacheMetadata });
    if (baselineCopy.statements.length) fail("The baseline target is not a completed source replica.");
    const appNames = new Set(source.tables.map((table) => table.name));
    const archived = (snapshot) => ({ schema: snapshot.schema.filter((item) => !appNames.has(item.tbl_name)), tables: snapshot.tables.filter((table) => !appNames.has(table.name)), excludedProviderTables: snapshot.excludedProviderTables });
    const archivedSnapshot = (snapshot) => ({ ...snapshot, ...archived(snapshot) });
    if (destinationFingerprint(archivedSnapshot(baselineTarget)) !== destinationFingerprint(archivedSnapshot(currentTarget))) fail("Target provider or migration metadata changed outside the delta.");
    const desired = structuredClone(activeBaselineTarget);
    for (const table of source.tables) {
      const previous = original.tables.find((item) => item.name === table.name);
      const baseline = activeBaselineTarget.tables.find((item) => item.name === table.name);
      const oldSource = indexRows(previous);
      const oldTarget = indexRows(baseline);
      const rows = new Map([...oldTarget].filter(([identity]) => !oldSource.has(identity)));
      for (const row of table.rows) {
        const identity = rowKey(table, row);
        const old = oldSource.get(identity);
        const target = oldTarget.get(identity);
        if (!old && target && !sameRow(row, target)) fail(`Independent source insertion conflicts with a baseline target row in table ${table.name}.`);
        rows.set(identity, structuredClone(sameRow(old, row) ? target : row));
      }
      desired.tables.find((item) => item.name === table.name).rows = [...rows.values()];
    }
    // Retained cache values are valid only for the current complete business
    // identity. A changed phone/location/maps source falls back to source values.
    for (const table of source.tables.filter((item) => ["catalog_state", "workshop_google_places"].includes(item.name))) {
      const baseline = indexRows(activeBaselineTarget.tables.find((item) => item.name === table.name));
      const wanted = desired.tables.find((item) => item.name === table.name);
      for (const row of table.rows) {
        const identity = rowKey(table, row);
        const at = wanted.rows.findIndex((item) => rowKey(table, item) === identity);
        const cached = baseline.get(identity);
        if (cached && !sameRow(row, cached) && retainValidatedCacheMetadata === true && retainCacheMetadata(table, row, cached, source, desired)) wanted.rows[at] = structuredClone(cached);
        else if (!sameRow(row, wanted.rows[at])) wanted.rows[at] = structuredClone(row);
      }
    }
    const projectedCurrentSource = allowExpiredAuthAttemptsAt === undefined ? currentSource : { ...currentSource, tables: currentSource.tables.map((table) => table.name === "auth_attempts" ? { ...table, rows: source.tables.find((item) => item.name === "auth_attempts").rows } : table) };
    const complete = planDataTransfer(projectedCurrentSource, desired, { migrations, retainValidatedCacheMetadata });
    if (complete.statements.length) fail("Desired delta state is missing current source rows.");
    const statements = [];
    const summary = [];
    for (const table of source.tables) {
      const baseline = indexRows(activeBaselineTarget.tables.find((item) => item.name === table.name));
      const currentTable = activeCurrentTarget.tables.find((item) => item.name === table.name);
      const current = indexRows(currentTable);
      const wanted = indexRows(desired.tables.find((item) => item.name === table.name));
      const counts = { table: table.name, insert: 0, update: 0, delete: 0, unchanged: 0 };
      const columns = table.columns.map((column) => column.name);
      for (const identity of new Set([...baseline.keys(), ...current.keys(), ...wanted.keys()])) {
        const old = baseline.get(identity); const actual = current.get(identity); const next = wanted.get(identity);
        if (sameRow(actual, next)) { counts.unchanged++; continue; }
        if (!sameRow(actual, old)) fail(`Unexpected target drift in table ${table.name}; no delta writes planned.`);
        let operation;
        let sql;
        let params;
        if (!actual) {
          operation = "insert";
          sql = `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
          params = columns.map((column) => next[column]);
        } else {
          const condition = columns.map((column) => `${quote(column)} IS ?`).join(" AND ");
          if (!next) { operation = "delete"; sql = `DELETE FROM ${quote(table.name)} WHERE ${condition}`; params = columns.map((column) => actual[column]); }
          else { operation = "update"; sql = `UPDATE ${quote(table.name)} SET ${columns.map((column) => `${quote(column)}=?`).join(",")} WHERE ${condition}`; params = [...columns.map((column) => next[column]), ...columns.map((column) => actual[column])]; }
        }
        if (params.length > 95) fail(`Delta table ${table.name} exceeds the verified binding limit.`);
        statements.push({ table: table.name, operation, sql, params, before: actual ? structuredClone(actual) : null, after: next ? structuredClone(next) : null });
        counts[operation]++;
      }
      summary.push(counts);
    }
    // Expired target rows remain physically intact. They are never restored,
    // deleted, or used to forgive an active counter/permission difference.
    if (allowExpiredAuthAttemptsAt !== undefined) {
      const activeKeys = new Set(activeCurrentTarget.tables.find((table) => table.name === "auth_attempts").rows.map((row) => row.key));
      desired.tables.find((table) => table.name === "auth_attempts").rows.push(...currentTarget.tables.find((table) => table.name === "auth_attempts").rows.filter((row) => !activeKeys.has(row.key)).map((row) => structuredClone(row)));
    }
    statements.sort((a, b) => ["delete", "update", "insert"].indexOf(a.operation) - ["delete", "update", "insert"].indexOf(b.operation));
    targetProof.database.exec("BEGIN");
    try {
      for (const statement of statements) if (targetProof.database.prepare(statement.sql).run(...statement.params.map(decode)).changes !== 1) fail("Delta comparison-and-swap rehearsal failed.");
      if (targetProof.database.prepare("PRAGMA foreign_key_check").all().length) fail("Delta foreign-key rehearsal failed.");
    } catch { fail("Delta constraint rehearsal failed; no remote writes were made."); }
    finally { targetProof.database.exec("ROLLBACK"); }
    return { format: 1, baselineFingerprint: expectedBaselineFingerprint, desiredFingerprint: destinationFingerprint(desired), retainedMetadata: complete.retainedMetadata, expiredAuthAttempts: { cutoff: allowExpiredAuthAttemptsAt ?? null, sourceExcluded: sourceExpired, targetRetained: targetExpired }, summary, statements, desiredSnapshot: desired };
  } finally { targetProof.database.close(); baselineProof.database.close(); }
}

export function applyDeltaChunkToSnapshot(snapshot, chunk) {
  const result = structuredClone(snapshot);
  for (const statement of chunk) {
    const table = result.tables.find((item) => item.name === statement.table);
    const identity = rowKey(table, statement.before ?? statement.after);
    const at = table.rows.findIndex((row) => rowKey(table, row) === identity);
    if (statement.operation === "insert") { if (at !== -1) fail("Delta insert expectation failed."); table.rows.push(structuredClone(statement.after)); }
    else {
      if (at === -1 || !sameRow(table.rows[at], statement.before)) fail("Delta mutation expectation failed.");
      if (statement.operation === "delete") table.rows.splice(at, 1);
      else table.rows[at] = structuredClone(statement.after);
    }
  }
  return result;
}
