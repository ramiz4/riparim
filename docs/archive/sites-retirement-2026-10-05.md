# Sites retirement — October 5, 2026

Historical completion of [#20](https://github.com/ramiz4/riparim/issues/20).
The user ended fallback at **09:51:01 Europe/Belgrade (07:51:01 UTC)**;
execution ran **09:52:54–09:58:38**. Public access was retired reversibly;
project/resources remained for recovery. No final deletion was authorized.

## Inventory and execution

Source project `appgprj_6abfd028b7e48191822a15d44cbbda8d` retained version 42,
[v1.2.0](https://github.com/ramiz4/riparim/releases/tag/v1.2.0), commit
`bf0af1913102710925efcadbfa9d3fff7631b694`, 17 app/two system tables, 386 rows,
zero private objects. Original e3 history and release bundles were secured.
Production independently used owned Worker/D1/R2 and v1.2.9.

| Action                   | Verified result                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Source access            | `custom`, policy revision 3, one owner, no other visitors/groups                                                |
| Old domains              | Removed only apex `appgdom_6ac0ffb23eb481919cf1ad20c799ecae` and www `appgdom_6ac0ffd2de708191ab09da6e4a896478` |
| Owned domains/TLS        | Unchanged; no owned DNS/mail/verification edits                                                                 |
| Export configuration     | Removed only token hash, expiry, source commit; read-only stayed true                                           |
| Private deployment       | Existing verified version 42, runtime revision 18, `appgdep_6ac358569efc8191b9841848bccea8b5`                   |
| Anonymous old URL/export | HTTP 401 at `mjeshter-kosovo.r-loki.chatgpt.site`                                                               |
| Remaining state          | Owner/project/versions/D1/R2 retained; no linked automations; old physical cron write-locked                    |

Shared Supabase/Google/Resend/Cloudflare CI and general Sites access stayed intact.
Old export access was removed; permanent revocation of earlier short-lived Git
access was not claimed. Production needed no old Git connection.

## Protected archive and recovery

Archive `aa0d0eaf-05fe-4c62-a19b-b3a6e60849a9` is private outside managed worktrees
and encrypted in the project vault, with its random 256-bit key in a separate entry.
Private receipt identifies paths/entries. AES-256-GCM format:
`RIPARIM-SITES-AES256GCM-V1`; ciphertext SHA-256:
`5af82e3e8caf6ad481e8c66b7b417f2bf4225e47893ca0fb2e4307747f2941be`.

It preserves the full export/manifest/receipt, runtime configuration, provider/DNS
metadata, final delta, release archive and Git bundles. Masked secrets were backed
by separate protected vault values; recheck validity before reuse.

| Payload                      | Fingerprint                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Sites v1.2.0 archive         | `26ba05a8ef7190479d07cd5e4ff3258f0cd234e2c749f750873b8e8ddbdf9cf8`                     |
| Reconstructed version-42 TAR | `e83f183cd41920a31d4178548cbd73c8c68a5b8974c7743cb08087e7d9072459`                     |
| Original Git state           | `e3d92c79da31bdf392a64c14d319eefb4aeca92b`, branch `codex/sites-source-backup-e3d92c7` |

TAR was reconstructed from trusted release files, not downloaded from the provider:
6,154,240 bytes/254 files, identical paths/content, canonical sorted regular files,
zero UID/GID/mtime, empty owners, mode `0644`. Fifteen payload hashes, decryption,
13 migrations, SQLite integrity/foreign keys and independent vault download hash
passed; temporary plaintext/keys were removed.

Recovery first verifies ciphertext/all payload hashes and locally validates snapshot,
manifest/migrations with `loadVerifiedSourceBackup`/`restoreSnapshot`.
Select the original bundle's named branch explicitly; release code uses its tag.
Unknown API/vault acknowledgments stop dependent steps; never retry blindly.
Reopening old source requires fresh reverse transfer/permissions and sole-writer
acceptance under [provider switching](../operations/provider-switch.md).

## Acceptance and retention

Production kept HTTP 200 apex, canonical HTTP 308 www and v1.2.9 throughout.
Five preflights/15 actual Auth/private-file checks passed at **10:02:59**:
login, roles, blocks/logout revocation, own/admin access, foreign/anonymous denial.
Three synthetic accounts/data/PNG were removed; zero residual accounts/errors.
Google login/admin/logout passed; no actual emails/review moderation occurred.
Private journal: `1ed4fac9-7739-42da-ae97-709d36d7b6f8`.

Archive, keys and old resources have **30-day minimum retention, until at least
November 4, 2026**. The date triggers no deletion; any final deletion requires
separate authorization. Preserve private artifacts before task-worktree archival.
