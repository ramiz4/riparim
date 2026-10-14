# Application data transfer

Use the protected export and verified restore for an explicitly authorized switch.
The original Sites → Cloudflare transfer is [historical evidence](../archive/data-transfer-2026-10-04.md),
not a current synchronization claim. An empty migrated database is not a data transfer.

## Freeze and export

Stop/drain all app/delivery writers, requests, uploads and deletions first.
Configure these protected source runtime values:

| Value                           | Contract                                                         |
| ------------------------------- | ---------------------------------------------------------------- |
| `MIGRATION_READ_ONLY=true`      | Blocks all app requests, including GET side effects and delivery |
| `MIGRATION_EXPORT_TOKEN_SHA256` | SHA-256 of a generated 256-bit token                             |
| `MIGRATION_EXPORT_EXPIRES_AT`   | Valid ISO deadline, at most 24 hours                             |
| `MIGRATION_SOURCE_COMMIT`       | Independently verified exact main release commit                 |

Verify the explicit maintenance marker/release commit, not merely HTTP 503.
`/__migration/export` requires the valid bearer token and exact configuration.
Export authorization expires; **the pause does not**. Resume only by explicit
operational decision and reconciliation. Source publication uses the unchanged
verified archive for its provider; preserve history and stop on source-branch divergence.

```sh
node scripts/export-source.mjs < /protected/path/export-options.json
```

Protected JSON fields: `origin`, `token`, `expectedProjectId`, `expectedCommit`,
`directory` (new absolute backup directory). Supply credentials through protected
stdin/Authorization, never argv/logs. Store backups outside Git/public with private
parent directories (`0700`) and files (`0600`). An interrupted export is incomplete.

Export includes actual schema/tables and accessible migration history, private
bytes/SHA-256/keys, ETags, times and HTTP/custom metadata, including unreferenced
objects. Provider-internal `_cf_*` tables are explicitly excluded.
[Trusted recovery](../../scripts/data-transfer.mjs) uses committed migrations,
never export SQL; schema/history must match a known state. Source history is archived,
target history remains intact. Verify completion receipts and isolated recovery.

## Restore to Node

The target parent must be canonical/private; all target processes remain stopped.

```sh
node scripts/restore-node.mjs < /protected/path/restore-options.json
```

JSON fields: `sourceDirectory`, `expectedProjectId`, `expectedCommit`, `directory`
(new absolute Node data directory). Verify source identity from an independent receipt.
The tool preserves mappings, ownership, approvals, blocks/tombstones, reservations,
mail state and private metadata/ETags; it validates migration hashes and publishes
both databases plus receipt only as a complete directory.
An identical retry checks the unchanged complete result. Any new row, modification,
deletion or file change rejects the old restore. After a crash, inspect only owned
lock/staging remnants once every restore/app process is stopped and backups secured.

## Fixed D1 import and final delta

The existing [D1 tool](../../scripts/import-d1.mjs) targets the owned account/database
and is not a generic reverse import. Run with protected JSON stdin; it plans by
default, mutates only with `execute: true`, and requires verified source/target backups.
Identical rows are no-ops; missing keys can be inserted; collisions/differences stop.
Additional target records remain visible/preserved. No arbitrary SQL or blanket replace.
The explicit cache-metadata exception preserves only proven equivalent source import
and Google identity metadata; quotas, roles and business data remain exact.

For a final Sites cutover delta, [apply-delta-d1.mjs](../../scripts/apply-delta-d1.mjs)
compares the verified transfer baseline with freshly paused source/target inventories:

```sh
node scripts/apply-delta-d1.mjs < /protected/path/delta-options.json
```

| Protected JSON fields                                                         | Evidence                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `baselineSourceDirectory`, `preTransferTargetDirectory`, `transferReportFile` | Original completed transfer baseline                                   |
| `sourceDirectory`, `expectedSourceCommit`                                     | Fresh source backup and verified release                               |
| `destinationDirectory`, `expectedCommit`                                      | Fresh target backup and release                                        |
| `sourceOrigin`, `sourceToken`, `sourceProbeParent`, `token`                   | Protected pause probes and fixed-target access                         |
| `expiryProjection` (optional)                                                 | `witnessDirectory`, `expectedWitnessCommit`, `receiptFile`             |
| `execute`                                                                     | Only boolean `true` authorizes tool mutations within the reviewed plan |

Unchanged source rows preserve target values; source changes produce bounded
inserts/updates/deletes. Other target deviations stop. The optional expiry receipt
proves only valid Auth counters expired before a fixed witness cutoff; it restores
or deletes no counters and proves no IP identity. Raw final inventory still matches.
Source private-file changes cause **No-Go before D1 writes** until a separate R2
delta is reviewed. Objects/references, bytes and metadata require complete verification;
recreated R2 ETags are new provider values and need reservation reconciliation.

## Retry and acceptance

Before each section, recheck authenticated source pause/fingerprint and explicit
target maintenance/release marker. Lost acknowledgment means stop, create a fresh
backup and recalculate; never blindly repeat writes. Final full inventory and a new
empty plan must match. Keep source/target paused until [domain acceptance](domain-cutover.md).
Check unchanged provider identity, admin/ownership/blocks, login/logout, moderation,
own/admin private access and rejected foreign/anonymous access. Preserve backups
and private receipts through handover; [provider switching](provider-switch.md)
defines the return path including newer deletions and delivery state.
