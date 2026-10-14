# Back up Supabase Auth

The `Backup: Supabase Auth` workflow backs up the complete `auth` schema of the
existing Riparim project daily at **03:23 UTC** (04:23 Swiss winter time,
05:23 summer time). This includes users and password hashes, provider identities,
MFA data, sessions, tokens and Auth migration history.
`pg_dump` uses a consistent database snapshot; the app remains available.
This is not an export of the admin user list, which lacks complete password hashes.

## Protection, retention and costs

- Fully verified TLS through the free session pooler (port 5432).
- Temporary plaintext files only in the private working directory of the
  ephemeral runner. Errors/SQL/data are not written to public logs.
- Encryption before upload with OpenSSL CMS, RSA-3072 and AES-256-GCM.
  GitHub contains only encrypted Auth data and a completion receipt.
- The private decryption key is in the existing project entry in 1Password,
  field **`SUPABASE_AUTH_BACKUP_PRIVATE_KEY`**. The public recipient certificate
  fingerprint can be checked against the `SUPABASE_AUTH_BACKUP_RECIPIENT_CERT`
  field. Never include the private key in Git, GitHub secrets, workflow logs
  or command arguments.
- The `auth-backup` environment permits only `main`. Its database password is
  stored in the `SUPABASE_AUTH_BACKUP_DATABASE_PASSWORD` secret. This is privileged
  database access: carefully restrict access to the environment/workflows. The job
  uses read-only transactions; the credentials themselves are not read-only.
- 14-day GitHub artifact retention. At most 16 MiB per dump; actual Auth data is
  currently much smaller. Standard runners are free in the public repository.
  Artifact storage and Supabase egress share the respective account free allowances
  with other users, so this is not an unconditional cost guarantee. As usage grows,
  check storage/traffic first; do not upgrade to a paid plan automatically.
- A failed run publishes no new backup. GitHub may delay scheduled runs; schedules
  in inactive public repositories are disabled after 60 days without repository
  activity. Check run status and backup age; use the existing GitHub Actions
  notifications. No further automation or email fee has been set up.

The independent [email monitoring of both backup jobs](backup-monitoring.md) is
prepared and disabled at the operator's request. Its later activation and receipt
acceptance are documented separately.

## Recovery

1. Download the artifact of a successful run. Work in a private directory
   (`0700`, files `0600`). `manifest.json` must name the expected project;
   check the SHA-256 of `auth.dump.cms` against the receipt.
2. Read the private key from 1Password into a temporary private file without
   displaying it, using the clipboard or passing its value as an argument. Decrypt:

   ```sh
   umask 077
   openssl cms -decrypt -binary -inform DER -in auth.dump.cms \
     -inkey /protected/path/private-key.pem -out auth.dump
   pg_restore --list auth.dump > archive-list.txt
   ```

   On authentication errors, discard all decrypted output; a failed GCM run
   may have written unauthenticated plaintext bytes.

3. First verify in an isolated environment with a compatible PostgreSQL/Supabase
   Auth version. The archive contains schema and data, but no ownership/ACLs.
   An empty local PostgreSQL instance can restore the archive structure and data;
   for an actual Supabase restore, preserve the provider's tables and roles and use
   a reviewed data transfer plan. Do not blindly run `--clean` against production.
   Check migration state, table contracts, user IDs, password hashes, provider
   identities and MFA.
4. Auth configuration, OAuth/SMTP credentials, redirects and JWT/API keys are
   **not part of this database snapshot**. The supplementary
   [platform backup](platform-backups.md) backs up Auth configuration and D1/R2.
   Separately compare the existing 1Password configuration and
   [Auth provider guide](auth-provider.md). Cloudflare D1/R2 app data also needs
   its own consistent restore; old Auth accounts must not reactivate app accounts
   deleted in the meantime.
5. Before resuming production, selectively revoke old sessions/tokens and actually
   verify email/Google login with isolated accounts. A verified database restore
   alone does not prove that login works. A production restore requires its own
   authorization and an agreed write pause.

When rotating keys, retain old keys at least as long as the backups encrypted
with them. After verification, remove the plaintext dump and temporary key from
the private working directory.

Sources: [Supabase backups](https://supabase.com/docs/guides/platform/backups),
[database connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
