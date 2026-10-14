# Switch providers safely

Riparim supports Cloudflare or a single Node/SQLite host, Supabase-compatible Auth
or PocketBase, and Resend or Node SMTP. Another protocol/database needs an explicit
adapter. A switch requires its own authorized data/domain operation.

## Prepare

1. Select a fully published verified main release and record commit/checksums.
   Install the [prebuilt Node package](node.md) when moving to Node; keep the new
   data directory unused and all target processes stopped.
2. Verify protected [backups and isolated recovery](backups.md), source/target
   inventories, DNS/TLS, callbacks and sender. Back up provider accounts/hashes,
   configuration/keys and DNS separately from app data.
3. Prepare exact [Auth identity mappings](auth-provider.md), including roles,
   blocks, tombstones and started deletions. An admin list or matching email is
   insufficient. Without proven password-hash compatibility, plan controlled resets.
4. Announce the final write pause with start/end/time zone and recovery decision.
   Keep the user informed if it overruns.

## Transfer and activate

1. Stop/drain every old and new writer, delivery process, request, upload and
   deletion. Enable/verify the [protected export pause](data-transfer.md).
   Export access expiry never resumes app access or delivery.
2. Capture a fresh complete app/file export and verify its completion receipt,
   schema, hashes, metadata and original source identity. Store it outside Git/public
   (`0700` directories, `0600` files); never log tokens, rows, keys or SQL bindings.
3. Restore into a **new** private target with [the transfer tools](data-transfer.md).
   Node publishes both databases only after full verification. Old backups cannot
   be retried over a used target; no automatic resurrection of deleted data.
4. With writers still stopped, migrate/provider-verify accounts and mappings,
   configure target Auth/trust-bound credentials, Google and SMTP separately.
   Retire old provider/app sessions; require new login. Transfer no old bearer,
   refresh or recovery tokens as a login shortcut.
5. Preserve started [mail events](mail-transports.md) and their transport bindings.
   Reconcile uncertain delivery externally; SMTP `unknown` must not be resent.
6. Verify approved/hidden profiles, same internal ownership, own/admin and denied
   foreign/anonymous private access, roles/blocks, moderation, notification and
   deletion with isolated accounts. Forged metadata/native headers grant no rights.
7. Complete [domain/TLS cutover](domain-cutover.md), then activate the target as the
   **sole writer**. Leave the source locked; prove test-data cleanup and document
   actual acceptance. Configuration, code and data are separate checks.

## Return without losing newer data

Before the first target write, an unchanged verified source can be resumed
explicitly. After activation, never reopen its old database blindly.

Stop/drain the new writer and capture its **fresh complete** export, including new
rows, changes, deletions, tombstones, mappings, private files and outbox acceptances.
Restore/reconcile into a fresh compatible return environment; verify provider
accounts/keys and renewed login separately. Preserve `unknown`/accepted messages.
Switch domain/writer only after complete inventory and access acceptance.
A return to used D1/R2 needs its own reviewed reconciliation plan; Node restore
provides no general merge. Prefer a verified forward fix when this path is unproven.

## Evidence and limits

Node restore/runtime tests exercise real isolated D1/R2 export, SQLite/private-file
restore, production HTTP routes, Auth protocol instances, SMTP acceptance and a
fresh reverse export containing deletion. They reject an old backup retry.
These tests do not prove real password-hash import, Google migration, DNS/TLS
cutover or inbox receipt. Supabase [self-hosted restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
requires separate configuration/keys and version compatibility checks.
