# Back up Auth configuration, D1 and R2

The daily `Backup: Platform` workflow supplements the existing
[Auth data backup](auth-backups.md). It runs at 03:43 UTC (04:43 Swiss winter
time, 05:43 summer time), exclusively on `main`, with 14-day retention.
The decryption key is the same verified RSA key in the 1Password project entry
`mkp7xa42clfbreiv2q3b3nrq5y`, field `SUPABASE_AUTH_BACKUP_PRIVATE_KEY`.
Old Auth backups remain decryptable; no key is replaced.

## Inventory and scope

The check on 2026-10-12 found no scheduled independent D1/R2 backup and no
automatic Auth configuration backup. D1 already has Cloudflare Time Travel
(seven days on Workers Free). This recovery path does not replace an independent
copy and does not back up R2 objects.
D1 held about 553 KB; R2 held two objects totaling 26,528 bytes.

The new archive contains:

- The complete response from Supabase `GET /v1/projects/<ref>/config/auth`:
  Site URL, redirects, enabled providers, SMTP settings, email templates,
  registration, session, security and rate limit settings.
  All returned values remain in the encrypted archive. The OAuth/SMTP secret
  fields read live were not values directly matching the original vault keys.
  Such API representations must not be restored as passwords. Anything the API
  masks or does not export is not reconstructed this way; OAuth/SMTP secrets in
  the existing 1Password entry and signing/API keys to be created remain part
  of the recovery plan. No automatic PATCH requests against production.
  `supabase-auth-recovery.json` names the vault entry and associated fields
  without exposing their values in metadata or logs.
- A consistent SQL read snapshot of the D1 application schema, including
  application and migration data. Cloudflare and SQLite internal tables are
  explicitly excluded; `sqlite_sequence` counters for the backed-up
  AUTOINCREMENT tables are preserved separately.
- All R2 objects, including those without a current visit reference: bytes,
  keys, size, ETag, modification time, HTTP/custom metadata and SHA-256.
  Object paths are not used as local filenames.

## Consistency and verification

R2 is inventoried before the D1 snapshot. Downloads must preserve size and ETag;
a second complete inventory must match exactly. Changes, missing pages or files
abort the run without publishing a completed backup. Retry later if an upload
or deletion is active.
All D1 rows, row counts and the schema are captured in a single SQL read
statement. Columns are identified beforehand; the schema must remain unchanged
in the snapshot. Scalar subqueries bypass the small D1 compound-SELECT limit.
Column values are serialized using a balanced concatenation tree so that wide
tables do not exceed SQLite's expression depth limit. Text, including null bytes,
and BLOBs are backed up losslessly as hexadecimal values.
The native export requiring broader permissions is not used; there is no app
write pause and no automatic data modification.

Before encryption, D1 is restored into an isolated in-memory SQLite database
and checked for integrity, foreign keys and complete private file references.
Opening external files and extensions is blocked during this check. D1 and
Supabase have independent snapshot times; no atomic snapshot across providers
is claimed.

## Access, protection and free limits

The GitHub `platform-backup` environment allows only `main`. Required credentials
are `CLOUDFLARE_BACKUP_TOKEN` (D1 Read and Workers R2 Storage Read in the Riparim
account) and `SUPABASE_AUTH_CONFIG_TOKEN` (Auth Config Read only, for the existing
project only). Both access keys are also stored in the same 1Password project
entry. They are not stored in Git or public logs.

Transport uses verified HTTPS; redirects are rejected. API credentials have
only the confirmed read permissions and are not used for other targets.
Plaintext exists only in the runner's private temporary directory. The entire
archive is encrypted with RSA-3072/AES-256-GCM (CMS) before upload.
GitHub receives only `platform.tar.gz.cms` and the public SHA-256 receipt.

No paid plans, buckets or additional cloud services are set up.
Standard runners are free in the public repository; artifact storage, D1 reads
and R2 operations share existing free allowances. Safety limits: at most 1,000
objects, 4 MiB of R2 content and an 8 MiB compressed archive. Growth causes an
abort rather than an automatic allowance increase. The verified small data
volume leaves ample headroom. Still account for other account usage. GitHub
schedules may be delayed or disabled after 60 days without repository activity;
check backup age and run status.

The independent [email monitoring of both backup jobs](backup-monitoring.md) is
prepared and disabled at the operator's request. Its later activation and receipt
acceptance are documented separately.

## Recovery

1. Download a successful artifact to a private directory and check the ciphertext
   SHA-256. Decrypt with the key stored in 1Password according to the
   [Auth backup guide](auth-backups.md) (`openssl cms`, `-binary -inform DER`).
   On GCM errors, discard all output.
2. First inventory the tar contents; allow only regular files in `snapshot/`,
   with no absolute paths, traversal segments or links. Check account, project,
   database, bucket and all content checksums against the encrypted manifests.
3. First restore D1 in an isolated SQLite/D1 environment. Check table contracts
   and Drizzle migrations, ownership, moderation status, identities, deletion
   tombstones and outbox states against the current code. Do not blindly
   overwrite newer production data.
4. Reconstruct R2 files and metadata in a private test bucket or through the
   verified Node restore. Original ETags are in the manifest; R2 assigns its
   own ETags when recreating objects. Reservations and conditional uploads
   must be reconciled according to the existing data transfer contract.
   The archive alone does not authorize a production restore.
5. Compare Auth configuration in a compatible isolated instance. Configure
   SMTP/Google secrets, redirects, new signing/API keys and separate Auth data;
   verify actual login, private downloads and account deletion. Revoke old
   sessions. Source and target need an agreed recovery authorization and write
   pause according to the [provider exit guide](provider-exit.md).

Sources: [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/),
[D1 SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/),
[Supabase Auth Config](https://supabase.com/docs/reference/api/v1-get-auth-service-config).
