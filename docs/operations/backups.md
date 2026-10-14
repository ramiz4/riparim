# Backups and recovery

Two main-only GitHub workflows create daily encrypted backups with **14-day retention**.
They complement each other; neither archive is a complete provider migration alone.

| Workflow                                                         | UTC schedule | Contents                                                                           | Size limit                                        |
| ---------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| [Backup: Supabase Auth](../../.github/workflows/auth-backup.yml) | 03:23        | Complete `auth` schema: users/hashes, identities, MFA, sessions/tokens, migrations | 16 MiB dump                                       |
| [Backup: Platform](../../.github/workflows/platform-backup.yml)  | 03:43        | Supabase Auth configuration, D1 schema/data/history, all private R2 bytes/metadata | 1,000 objects, 4 MiB R2, 8 MiB compressed archive |

GitHub schedules may be delayed or disabled after inactivity. Check run/artifact age;
[backup monitoring](backup-monitoring.md) is configured active on Cloudflare.
No automatic paid upgrade or allowance increase is permitted.

## Access and protection

| Protected GitHub environment | Credential                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| `auth-backup`                | `SUPABASE_AUTH_BACKUP_DATABASE_PASSWORD`                                |
| `platform-backup`            | `CLOUDFLARE_BACKUP_TOKEN`: D1/R2 Read only in the owned account         |
| `platform-backup`            | `SUPABASE_AUTH_CONFIG_TOKEN`: Auth Config Read for the existing project |

Auth uses a read-only transaction over verified TLS via the session pooler.
The database credential itself remains privileged. Restrict workflow/environment access.
Plaintext exists only in private runner temporary storage. OpenSSL CMS encrypts
with RSA-3072/AES-256-GCM before upload; GitHub receives ciphertext and a receipt.
The private key stays in the existing 1Password project entry under
`SUPABASE_AUTH_BACKUP_PRIVATE_KEY`; verify the recipient certificate through
`SUPABASE_AUTH_BACKUP_RECIPIENT_CERT`. Never place the private key in Git or CI secrets.
Keep old keys while retained backups still require them.

Existing runner/artifact/API usage shares free account allowances.
Limit failures publish no completed backup; review usage rather than upgrading.
D1 Time Travel is supplementary and does not protect R2 or create an independent copy.

## What the platform archive proves

D1 application tables and migration data form one SQL read snapshot.
Cloudflare/SQLite internal tables are excluded; AUTOINCREMENT counters are preserved.
R2 inventory before and after download must match; every object's size/ETag must
remain unchanged. Missing files or concurrent inventory changes abort publication.
D1 is restored in isolated SQLite before encryption, checking integrity, foreign
keys and private references. Supabase and D1 have separate snapshot times.

Auth configuration is the complete returned API response. Masked/transformed
OAuth/SMTP fields are **not usable passwords**. `supabase-auth-recovery.json`
identifies protected vault fields needed separately. Signing/API keys, account data
and unexported values are not reconstructed from configuration responses.
PocketBase accounts/configuration are outside these Supabase backups.

## Recover in isolation first

1. Download a successful artifact into a private directory (`0700`, files `0600`).
   Check the receipt's expected project/resources and ciphertext SHA-256.
2. Retrieve the key privately into a temporary file, without clipboard, argv or logs.
   Decrypt with the command below; on any GCM/authentication error, discard all output.
3. For Auth, inspect `pg_restore --list`; restore only in compatible isolated
   PostgreSQL/Supabase. Preserve provider roles/tables; no blind production `--clean`.
   Check hashes, identities, MFA and migration contracts.
4. For platform, inventory tar entries before extraction: regular files under
   `snapshot/` only, no absolute/traversal paths or links. Check encrypted manifests
   and every checksum. Restore D1 privately with trusted migrations; reconcile
   ownership, approvals, blocks, tombstones and outbox against current code.
5. Recreate private R2 files/metadata in an isolated bucket or [Node restore](data-transfer.md).
   Recreated R2 assigns new ETags; reconcile reservations/conditional writes.
6. Restore Auth configuration with separately verified OAuth/SMTP credentials,
   redirects and signing/API keys. Match app identity mappings; old provider
   accounts must not revive deleted app accounts. Revoke old sessions and verify
   real email/Google login, private access and deletion with isolated accounts.
7. Production recovery needs separate authorization, a write pause and complete
   reconciliation under [provider switching](provider-switch.md). Preserve newer writes.
   Remove temporary plaintext and keys after verification.

```sh
set -e
umask 077
openssl cms -decrypt -binary -inform DER -in auth.dump.cms \
  -inkey /protected/path/private-key.pem -out auth.dump
pg_restore --list auth.dump > archive-list.txt
```

For the platform artifact, use `platform.tar.gz.cms` as input and a private
`platform.tar.gz` output; the same CMS key applies. Authentication failure may
leave unauthenticated output bytes, so never continue after a failed decrypt.

Sources: [Supabase restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform),
[D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/).
