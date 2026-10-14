# Provider switching with a verified return path

Riparim can run on an ordinary Node host with local SQLite and private file
storage. Auth uses the app's own contract with two concrete adapters for Supabase
Auth (including a compatible self-hosted instance) and PocketBase.
Notifications can use SMTP instead of Resend. An arbitrary OIDC provider or
another database type still needs a targeted adapter change.
The switch is not a one-click operation.

## Sequence

1. Save the verified GitHub release from merged `main`, including commit/SHA-256.
   Build the same verified source with `npm run build:node`, prepare Node 24
   from 24.10, private persistent storage and a service user. Feature branches
   and open PRs are not published. Start no processes on the new data directory
   before complete recovery and configuration are finished.
2. Stop and drain all old writers, delivery crons/timers, active requests,
   uploads and account deletions. A write pause applies to both sides.
   Enable the existing protected export from [data-transfer.md](data-transfer.md):
   configure `MIGRATION_READ_ONLY=true`, a valid export token hash, short valid
   export deadline and exactly verified `MIGRATION_SOURCE_COMMIT`.
   The token is transmitted through protected stdin and Authorization.
   The pause does not expire with export authorization.
   The Node launcher also blocks all app requests before Next, including GETs;
   `notifications:node` does not work during this pause.
3. Run `scripts/export-source.mjs` according to the existing guide and check the
   complete completion receipt. Backup/parent directory 0700, files 0600,
   outside Git/`public/`; no account data, keys, object paths or SQL bindings
   in logs or argv. Back up Auth provider accounts, password hashes, OAuth
   settings, secrets and DNS configuration separately. They do not belong in
   the app backup. Session/grant data in the app backup also remains protected.
4. Import the entire app backup into a **new** Node data directory:

   ```sh
   node scripts/restore-node.mjs < /protected/path/restore-options.json
   ```

   The file contains only the following options; take project and commit from
   the independently verified completion receipt:

   ```json
   {
     "sourceDirectory": "/protected/path/backup",
     "expectedProjectId": "<verified-source-project>",
     "expectedCommit": "<40-character-reviewed-release-commit>",
     "directory": "/protected/path/new-node-data"
   }
   ```

   The parent path must already be private and canonical. All target processes
   remain stopped. Import checks completion, snapshot/manifest fingerprints,
   complete schema and private bytes/SHA-256. It runs only committed Drizzle
   migrations, transfers app data with internal/external identity mappings,
   roles, blocks, deletion tombstones, approvals, reservations and historical
   outbox states. Source migration data remains in the backup; target history
   proves actually executed migrations with hashes. `riparim_node_migrations`
   is recognized as exactly verified runtime history. Private bytes, original
   ETags, upload times and HTTP/custom metadata are preserved. Import deliberately
   avoids regular `bucket.put`, which would change reservation ETags.

   Both databases and their completion receipt are created in a private temporary
   directory; the entire directory is published only after complete verification.
   Errors before this step release no partial restore. An identical retry is
   exclusively a complete check of the unchanged result. Any new row,
   modification or deletion, including new file bytes, Auth configuration or
   identity link, stops the old import. No inserts into an already used target
   and no automatic resurrection of deleted reviews.
   After a process crash, `.restore-lock` and the private staging directory may
   remain. Retry deliberately does not blindly delete them. The operator checks
   and cleans only their own remnants after restore/app processes are safely
   stopped and the complete backup is secured.

5. Separately transfer Auth accounts to an actually compatible target version
   and check password-hash/Google contracts with isolated accounts.
   An admin list does not export complete password hashes. The official
   [Supabase restore guide](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
   describes version alignment, included Auth data and separate keys, OAuth/SMTP
   and renewed login. If the target cannot verifiably import hashes, a controlled
   reset is required. Configure Google subjects and target callback separately.
   Bind all exact source/target tuples, including blocks/tombstones, to the same
   internal IDs using existing `linkAccountIdentity` and independently verified
   provider identities; never through matching email or role metadata.
   With target processes still stopped, configure mapping, target Auth settings
   and separately bound secrets in a controlled server-side/offline manner
   according to [auth-provider.md](auth-provider.md). Disabled login or login
   still bound to the old custom host does not require available admin UI access
   for the switch.
6. Configure SMTP/sender/TLS and immediate event delivery according to
   [mail-transports.md](mail-transports.md). Already started events retain
   transport and credential binding. `unknown` or ambiguous SMTP acceptance
   requires external clarification; it must not be resent during a provider
   switch. SMTP 250 proves only server acceptance, not delivery to the inbox.
7. On the target, check public and hidden workshops, new login, the same internal
   ownership, own/foreign private evidence, moderation, notification and account
   deletion. Role metadata and forged native headers must grant no administrative
   rights. New login replaces old provider and app sessions; verify their
   retirement separately. Source stays locked. Only then switch domain/TLS/proxy
   and enable the target as the **sole writer**. Activation and domain cutover
   are operational actions and not part of the automated switch test.

## Return path preserving data

Before the first target change, it is possible to return to unchanged verified
source data. After operation starts, the old source is never blindly reopened.
First stop the new writer, including active delivery requests, drain all active
work and secure a **fresh complete target inventory** through the same protected
export. Node supports this export, including its runtime history and private objects.

Fully restore and verify this current inventory in a fresh compatible return
environment. New rows, edits, deletions, tombstones, identity aliases and delivery
acceptances must be included. Historical `unknown`/bound messages remain so;
an old outbox inventory must not resend already accepted messages.
Reconcile Auth provider data and keys separately; require new login.
Only switch domain/writer after access tests and inventory reconciliation.
Reverse import into an already used D1/R2 environment needs a separate reviewed
reconciliation plan; Node restore promises no blanket merge for this.

## Actual evidence and limitations

`npm test` registers `node-restore.test.mjs` and the switch probe within existing
`node-runtime.test.mjs`; only one test builds Next. The probe uses a real isolated
D1/R2 source inventory with protected export, a fresh Node/SQLite/private-files
restore, the actual Next production server and real SDK requests to two isolated
HTTPS Auth protocol instances. Only the test child trusts their synthetic
certificate. No production test hook or disabled TLS verification.
Actual HTTP routes check roles, blocks/tombstones, ownership, private downloads,
moderation, one acceptance per event by an isolated SMTP server and account
deletion. The paused Node server then captures a new export with that deletion;
its restore proves the return path. An old backup retry is rejected.
Offline checks prove original bytes/metadata, ETag reservations, history hashes
and no release with incomplete files.

This is reproducible app/protocol evidence. Actual password-hash migration,
Google account transfer, external DNS/TLS cutover and inbox delivery were not
performed. SQLite is accepted for one host with local persistent storage;
multiple hosts or network filesystems are untested. Cloudflare/Sites release
packages and their existing required checks remain required unchanged.
No production environment is enabled automatically.
