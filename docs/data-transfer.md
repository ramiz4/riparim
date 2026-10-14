# Transfer data from Sites to the owned Worker

The source Site remains intact during preparation and verification. An empty,
already migrated target database is not a completed transfer. #18 remains open
until backup, recovery, reconciliation and access tests have actually been
performed and documented; domain cutover #19 and retirement #20 follow.

## Resources and publication state

- Source: Sites project `appgprj_6abfd028b7e48191822a15d44cbbda8d`,
  `https://riparim.com`, logical bindings `DB` and `BUCKET`.
- Target account: `ec181b3a61c7c3da13910600953fc3ea`, Worker `riparim`.
- Target D1: `riparim-production`, `b395ea3a-5316-4b0b-bdee-533bdb68d6a0`.
- Target R2: `riparim-evidence-production`, private.

Source access uses the existing Worker bindings. The Sites connector offers no
complete database/file export. A Cloudflare token for the target account does
not thereby gain access to the source's platform resources. The transfer
therefore uses the verified Sites build from the same main release. The two
provider archives must not be swapped: the owned Worker removes native identity
headers; the Sites adapter preserves their existing behavior behind platform access.

Only a fully published GitHub release with matching source commit, project and
SHA-256 may be deployed to the source Site. The configured Sites source branch
must receive the exact release commit by fast-forward; stop on divergence.
Additional publication-only commits must not be presented as supposedly the
same archive commit. After additionally backing up the entire source history
on a separate branch and in a local Git bundle with recovery verification,
an alignment explicitly authorized by the user may be performed. It uses only
`--force-with-lease=refs/heads/main:<previously confirmed full SHA>` to the verified
release commit and aborts on any intervening change. Without this explicit
authorization, publication remains stopped.
The downloaded verified Sites archive is stored and published unchanged with
the native Sites tools.

## Protected export and write pause

The source receives the following protected runtime configuration; it belongs
neither in Git nor in PR text, logs or command arguments:

- `MIGRATION_READ_ONLY=true`: blocks the entire app handler, including GETs
  with automatic database modifications and scheduled notifications.
- `MIGRATION_EXPORT_TOKEN_SHA256`: SHA-256 of a cryptographically generated
  256-bit token. Plaintext is held only securely in the export process and
  transmitted through an Authorization header.
- `MIGRATION_EXPORT_EXPIRES_AT`: ISO timestamp valid for at most 24 hours.
- `MIGRATION_SOURCE_COMMIT`: exact, independently verified release commit.

The `/__migration/export` path returns 404 without this configuration and valid
authorization. It accepts no client SQL queries, client target resources or
cookie/UI admin shortcuts. Tables are checked against the actual SQLite schema;
small paginated responses preserve BLOB values. R2 is fully inventoried through
its cursor, including private objects without a current visit reference.
File keys are in the protected POST body; contents are streamed and read only
with an unchanged ETag.

Export authorization expires; the write pause does **not** end automatically.
After cutover, the old Site must not become a second write source.
Resumption requires an explicit operational decision and renewed reconciliation.
For fallback before the domain cutover, remove export values and explicitly lift
the write pause; delete no database or files.

Old requests and background work must drain before inventory capture.
Two identical complete inventories are an additional check, not a substitute
for this operational condition. Active uploads, deletions, uncertain quiescence
or a differing final reconciliation keep the state at No-Go. Existing deletion
or upload state is preserved and not automatically cleaned or marked complete.

## Backup and recovery

Backups are stored outside Git in a directory with mode 0700; files receive 0600.
The inventory contains all actual tables, schema objects and accessible migration
metadata. Reserved `_cf_*` tables are blocked by the provider for SQL reads;
their names are explicitly documented as excluded platform tables. This logical
export claims no backup of those internal provider data. Private SQL bindings
and session data are not exposed in diagnostics. File contents, size, SHA-256,
original object key, HTTP/custom metadata and source ETag are recorded.
An interrupted export does not count as complete.

`scripts/data-transfer.mjs` restores application data in isolation using only
committed SQL. Untrusted export SQL is never executed. The entire schema,
including columns, must prove exactly one known migration state; any existing
D1/Drizzle history must match it. The `__appgarden_migrations` actually used by
Sites is recognized only with its verified three-column definition, ordering
and exact committed filenames; it remains in the source archive and replaces
no target history. Missing history is reported as such and never replaced with
invented applied rows. Platform and source migration data remain unchanged in
the source archive. The upgrade adds only the proven missing migration suffix.

The same recovery check applies to the target backup. Its already applied
history is preserved. A data transfer does not replace a migration or replay
old CREATE/DROP statements over the production database.

## Import and acceptance

In addition to HTTP503/no-store, target verification requires the Worker's
explicit maintenance marker and its immutably embedded release commit.
An ordinary app outage does not count as an active write pause. Source identity
and inventory fingerprints are checked with authentication before and after
each import section.

Before import, back up both sides, verify recovery, fully verify files and create
a private plan. Identical records are no-ops; missing primary keys may be added.
Differing rows and unique collisions stop the plan. Additional target records
are also preserved and visible. There is no blanket replace, upsert or deletion
of unrelated data.
The explicit `retainValidatedCacheMetadata=true` option treats only two proven
cases as equivalent metadata: ISO completion times for the same
`workshop-source:<SHA>` import with an exactly identical complete profile
inventory; and Google identity caches with the same Place ID, complete profile
and review source when the target hash matches the current shared identity
function. Only cache timestamps or outdated source hashes may differ here.
Target values are preserved; output reports `retainedMetadata` separately.
Quota counters, business data, ownership, approvals and other mappings are never
equated this way. The original source and its fingerprints remain unchanged.
No UPDATEs are generated. Other catalogue conflicts require a separately reviewed plan.

Private objects are transferred under the same keys. Existing target objects
must demonstrably meet content and metadata requirements; otherwise stop.
Original provider ETags/upload times remain in the backup; newly generated R2
provider values must not be confused with unchanged file checksums.
References from `visits` and `evidence_uploads` are fully checked; a missing
private evidence file blocks the transfer.

On retries, recheck confirmed inserts against source and target. A lost commit
acknowledgment is no reason for a blind reimport. Output contains only counts
and check results. Finally perform a new complete source/target reconciliation
and confirm the write pause.

Go/No-Go additionally requires: unchanged Supabase project identity,
server-confirmed legacy links, preserved admin roles and account blocks,
login/logout, moderation, and permitted as well as foreign/anonymous evidence
requests. Matching email addresses create no ownership rights.
Login steps required with real accounts are documented separately from isolated
tests. Without this acceptance, no domain cutover and no closure of #18.

For a provider switch to Node, [provider-exit.md](provider-exit.md) uses the same
protected export and its schema/file evidence. The new offline restore publishes
both databases only as a complete new directory. A retry checks only the entire
unchanged state; modifications and deletions stop it. The existing D1 insert
plan is not a general return path into an already used inventory. The Node
export can prove a fresh reverse transfer including new deletions and delivery
states; its exact `riparim_node_migrations` history is checked against the
committed migrations.
