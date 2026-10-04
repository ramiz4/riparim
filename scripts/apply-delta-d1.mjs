import { randomUUID, createHash } from "node:crypto";
import { readFile, lstat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMigrationSet } from "./data-transfer.mjs";
import { d1Destination, destinationFingerprint, loadVerifiedSourceBackup, loadVerifiedDestinationBackup, snapshotDestination, queryClient } from "./import-d1.mjs";
import { exportSource } from "./export-source.mjs";
import { reconstructTransferredBaseline, projectExpiredAuthAttempts, planDataDelta, applyDeltaChunkToSnapshot } from "./data-delta.mjs";

const fail = (message) => { throw new Error(message); };
const sourceProjectId = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8")).project_id;
async function protectedJson(path) {
  if (!isAbsolute(path ?? "")) fail("An absolute protected audit file is required.");
  const info = await lstat(path);
  if (!info.isFile() || (info.mode & 0o077) !== 0) fail("Audit files must be private regular files.");
  const bytes = await readFile(path);
  try { return { value: JSON.parse(bytes), sha256: createHash("sha256").update(bytes).digest("hex") }; }
  catch { fail("Protected audit file is invalid."); }
}

export async function loadTransferredBaseline({ baselineSourceDirectory, preTransferTargetDirectory, transferReportFile, expectedSourceProjectId = sourceProjectId, migrations } = {}) {
  if (expectedSourceProjectId !== sourceProjectId) fail("The fixed source Sites project is required.");
  const { value: audit, sha256: transferReportSha256 } = await protectedJson(transferReportFile);
  if (resolve(audit.sourceDirectory ?? "") !== resolve(baselineSourceDirectory ?? "") || resolve(audit.destinationDirectory ?? "") !== resolve(preTransferTargetDirectory ?? "") || audit.result?.executed !== true || !Number.isSafeInteger(audit.result.inserted) || !Number.isSafeInteger(audit.result.retainedMetadata) || audit.result.sourceCommit !== audit.sourceCommit) fail("Transfer audit does not prove the supplied completed baseline.");
  const source = await loadVerifiedSourceBackup({ directory: baselineSourceDirectory, expectedProjectId: expectedSourceProjectId, expectedCommit: audit.sourceCommit });
  const target = await loadVerifiedDestinationBackup({ directory: preTransferTargetDirectory, expectedCommit: audit.expectedCommit });
  if (audit.sourceBackup?.snapshotSha256 !== source.report.snapshotSha256 || audit.sourceBackup?.manifestSha256 !== source.report.manifestSha256) fail("Transfer audit source backup checksums do not match.");
  const reconstructed = reconstructTransferredBaseline(source.snapshot, target.snapshot, { migrations, expectedFingerprint: audit.result.destinationFingerprint, expectedInserted: audit.result.inserted, expectedRetainedMetadata: audit.result.retainedMetadata });
  return { source, target: reconstructed.snapshot, fingerprint: reconstructed.fingerprint, transferReportSha256 };
}

export async function loadExpiryProjection({ witnessDirectory, expectedWitnessCommit, receiptFile }, baseline, { trustedExecutorTime = new Date().toISOString() } = {}) {
  const witness = await loadVerifiedDestinationBackup({ directory: witnessDirectory, expectedCommit: expectedWitnessCommit });
  const { value: receipt, sha256: receiptSha256 } = await protectedJson(receiptFile);
  const required = ["readOnly", "allOriginalExpiredAtCurrentSnapshot", "allAddedValidCounterKeys", "allAddedWindowsRecordedInQaLedger", "allAddedLastWritesWithinQaPeriod", "allAddedExpiryWindowsMatchLimiter", "allAddedExpiredAtCurrentSnapshot", "allSyntheticActorsRemoved", "activeSharedCountersMustBePreserved"];
  if (required.some((field) => receipt[field] !== true) || receipt.liveCleanupPerformed !== false || receipt.expiredCountersRestored !== false) fail("Recorded QA receipt does not prove the expired-counter exception.");
  const cutoff = witness.snapshot.exportedAt;
  const original = projectExpiredAuthAttempts(baseline.target, { cutoff, trustedExecutorTime });
  const current = projectExpiredAuthAttempts(witness.snapshot, { cutoff, trustedExecutorTime });
  if (destinationFingerprint(original.snapshot) !== destinationFingerprint(current.snapshot) || receipt.baselineRows !== baseline.target.tables.find((table) => table.name === "auth_attempts").rows.length || receipt.currentRows !== witness.snapshot.tables.find((table) => table.name === "auth_attempts").rows.length) fail("QA expiry projection does not explain every target difference.");
  return { cutoff, witnessFingerprint: destinationFingerprint(witness.snapshot), comparisonFingerprint: destinationFingerprint(current.snapshot), baselineExcluded: original.expired, witnessExcluded: current.expired, receiptSha256, ipIdentityProven: receipt.ipIdentityProven === true };
}

export async function applyDeltaPlan({ token, expectedCommit, expectedSourceCommit, expectedSourceProjectId = sourceProjectId, baselineSourceDirectory, preTransferTargetDirectory, transferReportFile, sourceDirectory, destinationDirectory, expiryProjection, execute = false, request = fetch, readOnlyProbe = fetch, sourcePauseProbe, accountId, databaseId } = {}) {
  const options = { token, expectedCommit, request, accountId, databaseId };
  const query = queryClient(options);
  const migrations = await loadMigrationSet();
  const baseline = await loadTransferredBaseline({ baselineSourceDirectory, preTransferTargetDirectory, transferReportFile, expectedSourceProjectId, migrations });
  const source = await loadVerifiedSourceBackup({ directory: sourceDirectory, expectedProjectId: expectedSourceProjectId, expectedCommit: expectedSourceCommit });
  const target = await loadVerifiedDestinationBackup({ directory: destinationDirectory, expectedCommit });
  // File inventory changes are a concrete No-Go until a separately verified
  // R2 delta is ready. Database mutations cannot create inaccessible evidence.
  if (source.report.objectsFingerprint !== baseline.source.report.objectsFingerprint) fail("Private evidence changed since the transfer baseline; a verified R2 delta is required before any D1 mutation.");
  const expiry = expiryProjection ? await loadExpiryProjection(expiryProjection, baseline) : null;
  const planOptions = { migrations, expectedBaselineFingerprint: baseline.fingerprint, allowExpiredAuthAttemptsAt: expiry?.cutoff };
  let current = await snapshotDestination(options);
  if (destinationFingerprint(current) !== destinationFingerprint(target.snapshot)) fail("Current destination changed since its protected backup; take a fresh backup.");
  const initial = planDataDelta(baseline.source.snapshot, baseline.target, source.snapshot, current, planOptions);
  const describe = (plan) => ({ summary: plan.summary, retainedMetadata: plan.retainedMetadata, expiredAuthAttempts: plan.expiredAuthAttempts, baselineFingerprint: plan.baselineFingerprint, desiredFingerprint: plan.desiredFingerprint });
  if (execute !== true) return { executed: false, planned: initial.statements.length, ...describe(initial), expiryProof: expiry };
  if (typeof sourcePauseProbe !== "function") fail("Authenticated unchanged-source maintenance proof is required for delta execution.");
  async function verifyPause() {
    let proof; let response;
    try { proof = await sourcePauseProbe(); response = await readOnlyProbe(`${d1Destination.origin}/`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(15_000) }); }
    catch { fail("Delta source or target maintenance could not be verified."); }
    if (!proof || proof.readOnly !== true || proof.sourceProjectId !== expectedSourceProjectId || proof.sourceCommit !== expectedSourceCommit || proof.dataFingerprint !== source.report.dataFingerprint || proof.objectsFingerprint !== source.report.objectsFingerprint || response.status !== 503 || response.headers.get("X-Riparim-Migration-Read-Only") !== "true" || response.headers.get("X-Riparim-Release-Commit") !== expectedCommit || !(response.headers.get("Cache-Control") ?? "").split(",").some((directive) => directive.trim().toLowerCase() === "no-store")) fail("Delta source changed or a released target is not safely paused.");
  }
  let expected = current;
  const applied = { insert: 0, update: 0, delete: 0 };
  while (true) {
    await verifyPause();
    current = await snapshotDestination(options);
    if (destinationFingerprint(current) !== destinationFingerprint(expected)) fail("Destination drifted before a delta batch; stop and reconcile from fresh protected backups.");
    const plan = planDataDelta(baseline.source.snapshot, baseline.target, source.snapshot, current, planOptions);
    if (!plan.statements.length) break;
    const chunk = plan.statements.slice(0, 50);
    if (chunk.some((statement) => statement.params.some((value) => value !== null && typeof value === "object"))) fail("Delta application BLOB bindings require separately verified REST encoding.");
    const results = await query(chunk.map(({ sql, params }) => ({ sql, params })), true);
    if (results.some((result) => result.meta?.changes !== 1)) fail("Delta compare-and-swap did not change exactly one row; refresh snapshots before retrying.");
    expected = applyDeltaChunkToSnapshot(current, chunk);
    for (const statement of chunk) applied[statement.operation]++;
  }
  await verifyPause();
  const final = await snapshotDestination(options);
  if (destinationFingerprint(final) !== destinationFingerprint(expected)) fail("Delta final raw destination verification failed.");
  const complete = planDataDelta(baseline.source.snapshot, baseline.target, source.snapshot, final, planOptions);
  if (complete.statements.length || destinationFingerprint(final) !== complete.desiredFingerprint) fail("Delta final reconciliation did not reach its exact expected raw state.");
  return { executed: true, applied, ...describe(complete), expiryProof: expiry, transferReportSha256: baseline.transferReportSha256 };
}

async function runCli() {
  let input = "";
  for await (const chunk of process.stdin) { input += chunk; if (Buffer.byteLength(input) > 32_768) fail("Protected delta input is too large."); }
  const options = JSON.parse(input);
  const allowed = new Set(["token", "expectedCommit", "expectedSourceCommit", "expectedSourceProjectId", "baselineSourceDirectory", "preTransferTargetDirectory", "transferReportFile", "sourceDirectory", "destinationDirectory", "expiryProjection", "execute", "sourceOrigin", "sourceToken", "sourceProbeParent"]);
  if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some((key) => !allowed.has(key))) fail("Protected delta options are invalid.");
  let sourcePauseProbe;
  if (options.execute === true) {
    if (!isAbsolute(options.sourceProbeParent ?? "")) fail("A protected source proof parent is required.");
    sourcePauseProbe = async () => (await exportSource({ origin: options.sourceOrigin, token: options.sourceToken, expectedProjectId: options.expectedSourceProjectId ?? sourceProjectId, expectedCommit: options.expectedSourceCommit, directory: join(options.sourceProbeParent, `delta-pause-${randomUUID()}`) })).report;
  }
  console.log(JSON.stringify(await applyDeltaPlan({ ...options, sourcePauseProbe })));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runCli(); }
  catch { console.error("Protected domain delta stopped. Keep the staged target paused and verify the protected backups before any retry or routing change."); process.exitCode = 1; }
}
