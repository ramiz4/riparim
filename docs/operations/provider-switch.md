# Switch providers safely

Use this checklist for an **authorized** provider/data/domain switch. Supported targets
are Cloudflare or one Node/SQLite host, Supabase-compatible Auth or PocketBase, and
Resend or Node SMTP. Other protocols/databases need an explicit adapter.

## Prepare

1. Choose a fully published [verified main release](releases.md); record commit/checksums.
   For Node, [prepare its package](node.md) with a new unused data directory and stopped
   target processes.
2. Verify [backups and isolated recovery](backups.md), inventories, DNS/TLS, callbacks
   and sender. Back up provider accounts/hashes, configuration/keys and DNS separately.
3. Prepare [exact Auth identity mappings](auth-provider.md), including blocked/deleting
   accounts. Email matches or admin lists are insufficient. Without proven hash-import
   compatibility, plan controlled password resets.
4. Announce pause start/end/time zone, operator and recovery decision. Report overruns.

## Transfer and activate

1. Stop/drain **all** source and target writers, requests, uploads, deletions and delivery
   processes. Verify the [protected export pause](data-transfer.md); token expiry does
   not resume app access or mail.
2. Capture a fresh complete app/file export. Verify receipt, schema, hashes, metadata
   and independently established source identity. Store outside Git/public with `0700`
   directories and `0600` files; log no tokens, rows, keys or SQL bindings. Keep private
   backups/receipts through handover.
3. [Restore into a new private target](data-transfer.md). A used target cannot accept an
   old backup retry. Preserve mappings, roles, ownership, approval, blocks, tombstones,
   started deletions and private files.
4. While stopped, verify provider accounts/mappings and configure trust-bound Auth,
   Google and SMTP separately. Retire old provider/app sessions and require new login;
   old bearer, refresh and recovery tokens are no login shortcut.
5. Preserve [started mail events and original transport bindings](mail-transports.md).
   Reconcile uncertain acceptance externally; SMTP `unknown` must not be resent.
6. With isolated accounts, verify published/hidden profiles, ownership, own/admin
   private access and denied foreign/anonymous access, blocks, moderation, notification
   and deletion. Forged metadata/native headers grant no rights. Prove test cleanup.
7. Complete [domain/TLS cutover](domain-cutover.md), activate the target as the
   **sole writer**, and leave the source locked. Perform customer acceptance immediately;
   record code, configuration and data acceptance separately.

## Return after a failure

Before any target write, explicitly resume only an unchanged verified source.
After target activation, its new data must be preserved before returning:

1. Stop/drain both sides and capture the target’s fresh complete export, including changes,
   deletions, tombstones, mappings, private files and delivery acceptances.
2. Restore/reconcile into a fresh compatible return environment. Verify provider
   accounts/keys and renewed login separately; preserve `unknown`/accepted mail.
3. Switch domain and sole writer only after complete inventory/access acceptance.

Never reopen the old database blindly. Used D1/R2 needs a separately reviewed
reconciliation plan; Node restore supplies no general merge. Prefer a verified
forward fix when reverse reconciliation is unproven.

Isolated restore/runtime tests cover transfer and runtime contracts. They do not
prove live hash import, Google migration, DNS/TLS or inbox receipt. Check
[Supabase restore compatibility](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
separately.
