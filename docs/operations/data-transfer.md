# Application data transfer

For an authorized switch, follow [provider switching](provider-switch.md) to stop/drain
all writers, requests, uploads, deletions and mail. An empty migrated database is not
an application data transfer. The old Sites transfer is [historical evidence](../archive/data-transfer-2026-10-04.md).

## Freeze and export

Configure the protected source runtime:

| Value                           | Required value                                                    |
| ------------------------------- | ----------------------------------------------------------------- |
| `MIGRATION_READ_ONLY`           | `true`; blocks every app request, including GET side effects/mail |
| `MIGRATION_EXPORT_TOKEN_SHA256` | SHA-256 of a generated 256-bit token                              |
| `MIGRATION_EXPORT_EXPIRES_AT`   | ISO deadline, at most 24 hours away                               |
| `MIGRATION_SOURCE_COMMIT`       | Independently verified exact main release commit                  |

Verify the maintenance marker/release, not just HTTP 503. The protected export endpoint
requires valid bearer/configuration. Token expiry **does not end the pause**; resumption
requires explicit decision/reconciliation. Preserve history and stop on source-branch
divergence; publish only the unchanged verified provider archive.

```sh
node scripts/export-source.mjs < /protected/path/export-options.json
```

Protected JSON fields are `origin`, `token`, `expectedProjectId`, `expectedCommit` and
`directory` (new absolute backup directory). Use protected stdin/Authorization, never
argv/logs. Keep backups outside Git/public, directories `0700`, files `0600`.

Require the complete receipt and isolated recovery. Interrupted export is incomplete.
Exports include schema/history and all private bytes/metadata, including unreferenced
objects. Provider-internal tables are excluded. Recovery uses committed migrations,
not exported SQL; source history is archived and target history preserved.

## Restore to Node

Keep target processes stopped and use a new directory under a canonical private parent:

```sh
node scripts/restore-node.mjs < /protected/path/restore-options.json
```

Protected JSON fields are `sourceDirectory`, `expectedProjectId`, `expectedCommit` and
`directory` (new absolute data directory). Verify source identity from an independent
receipt. The [restore tool](../../scripts/restore-node.mjs) publishes both databases
and receipt together after validation, preserving identities, rights, deletion/mail
state, private files/metadata and ETags.

An identical retry only verifies the unchanged complete result. Any new row, edit,
deletion or file change rejects the old restore. After a crash, inspect only owned
lock/staging remnants after stopping every restore/app process and securing backups.

## Existing fixed D1 tools

[import-d1.mjs](../../scripts/import-d1.mjs) and
[apply-delta-d1.mjs](../../scripts/apply-delta-d1.mjs) target the original owned account
and database; the delta tool also requires the original Sites baseline. Neither is a
general reverse-import/merge tool. Options come from
protected JSON stdin. Preview by default; only `execute: true` mutates a reviewed plan.
Require source/target backups. Before each section, recheck authenticated source
pause/fingerprint and the target maintenance/release marker.

Imports preserve extra target rows and reject conflicting keys/values. Only proven
equivalent cache/import metadata has an exception; quotas, roles and business data
remain exact. Delta file changes are **No-Go before D1 writes** until a separate R2 plan
is reviewed. Recreated R2 ETags need reservation/conditional-write reconciliation.

For lost acknowledgment, stop, back up afresh and recalculate rather than replaying
writes. Require matching full inventories and a new empty plan. Keep both sides paused
through [domain acceptance](domain-cutover.md); [provider switching](provider-switch.md)
defines access checks, receipt retention and a return that preserves newer data.
