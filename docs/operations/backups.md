# Backups and recovery

Two main-only workflows create daily encrypted backups with **14-day retention**.
Neither archive alone is a complete provider migration.

| Workflow                                                | UTC   | Contents                                                                | Limits                                            |
| ------------------------------------------------------- | ----- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| [Auth](../../.github/workflows/auth-backup.yml)         | 03:23 | Complete Supabase `auth` schema, including hashes/identities/MFA/tokens | 16 MiB dump                                       |
| [Platform](../../.github/workflows/platform-backup.yml) | 03:43 | Auth configuration, D1 schema/data/history, private R2 bytes/metadata   | 1,000 objects; 4 MiB R2; 8 MiB compressed archive |

Schedules may be delayed/disabled. Check successful run/artifact age and
[monitor health](backup-monitoring.md). Usage shares free allowances; never upgrade or
increase limits automatically. Limit failures create no completed backup. D1 Time Travel
is supplementary, not an independent backup or R2 protection.

## Protect access

| GitHub environment | Protected credential                                               |
| ------------------ | ------------------------------------------------------------------ |
| `auth-backup`      | `SUPABASE_AUTH_BACKUP_DATABASE_PASSWORD`                           |
| `platform-backup`  | `CLOUDFLARE_BACKUP_TOKEN` (owned D1/R2 read only)                  |
| `platform-backup`  | `SUPABASE_AUTH_CONFIG_TOKEN` (existing project's Auth Config Read) |

Restrict workflow/environment access: the Auth database credential remains privileged
although backup reads use verified TLS and a read-only transaction. Plaintext stays in
private runner temporary storage; GitHub receives ciphertext/receipt only.
The CMS private key stays in the existing 1Password project entry under
`SUPABASE_AUTH_BACKUP_PRIVATE_KEY`; verify `SUPABASE_AUTH_BACKUP_RECIPIENT_CERT`.
Keep old keys until retained backups expire. Never put private keys in Git or CI.

## Recover in isolation

1. Download a successful artifact privately (`0700` directory, `0600` files). Verify
   receipt resources/project and ciphertext SHA-256.
2. Retrieve the key into a private temporary file, never clipboard/argv/logs. Decrypt
   below. **On any authentication/GCM error, discard all output and stop.**
3. Auth: inspect `pg_restore --list`, then restore to compatible isolated
   PostgreSQL/Supabase. Preserve roles/tables; no blind production `--clean`. Verify
   hashes, identities, MFA and migration compatibility.
4. Platform: inventory tar entries before extraction. Allow only regular files under
   `snapshot/`, no absolute/traversal paths or links. Verify encrypted manifests and
   checksums; restore D1 with trusted migrations and reconcile app rights, approvals,
   tombstones and outbox.
5. Recreate private R2 bytes/metadata in isolation or [Node restore](data-transfer.md).
   New R2 ETags require reservation/conditional-write reconciliation.
6. Restore provider configuration with separately verified OAuth/SMTP credentials,
   redirects and signing/API keys. Match app identity mappings, revoke old sessions
   and test real email/Google, private access and deletion with isolated accounts.
   Deleted app accounts must not be revived by old provider accounts.

```sh
set -e
umask 077
openssl cms -decrypt -binary -inform DER -in auth.dump.cms \
  -inkey /protected/path/private-key.pem -out auth.dump
pg_restore --list auth.dump > archive-list.txt
```

For platform, substitute `platform.tar.gz.cms` and private `platform.tar.gz` output.
Failed decrypt may leave unauthenticated bytes. Remove temporary plaintext/keys after
verification. Production recovery requires separate authorization, a write pause and
[data-preserving reconciliation](provider-switch.md); preserve newer writes.

## Backup limits

Platform verification checks a D1 snapshot and unchanged complete R2 inventory; concurrent
changes abort publication. Auth and D1 have separate snapshot times. Masked OAuth/SMTP
configuration is not a password backup: `supabase-auth-recovery.json` identifies required
vault fields. Unexported signing/API keys need separate protection. PocketBase is not
covered. Provider guidance: [Supabase restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
and [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/).
