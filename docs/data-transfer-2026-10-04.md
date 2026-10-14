# Verified data transfer on October 4, 2026

## Result and operational state

The existing application was fully transferred to the owned Cloudflare data
stores and verified there. The import ended on **October 4, 2026 at
19:45:56 UTC**. The domain remains on Sites until #19. After the intervening
write pause, the previous Site is available again and is the only production
write path; the owned target remains on `MIGRATION_READ_ONLY=true` until the
coordinated domain cutover. A new delta reconciliation is required before cutover.

The technical owner for execution and the documented Go/No-Go decision is the
Codex agent assigned in this chat. Go applies to the verified data transfer
and target acceptance, not an uncoordinated domain cutover.

## Evidence

- Source publication: unchanged verified Sites archive from
  [v1.2.0](https://github.com/ramiz4/riparim/releases/tag/v1.2.0), commit
  `bf0af1913102710925efcadbfa9d3fff7631b694`, Sites version 42.
- Target and transfer tools: fully green
  [main workflow](https://github.com/ramiz4/riparim/actions/runs/37228912201),
  [v1.2.3](https://github.com/ramiz4/riparim/releases/tag/v1.2.3), commit
  `03bce9429492519de1af7067bca240eca9f53395`.
- Preparation and reviewed corrections:
  [PR #27](https://github.com/ramiz4/riparim/pull/27),
  [PR #28](https://github.com/ramiz4/riparim/pull/28) and
  [PR #30](https://github.com/ramiz4/riparim/pull/30).
- Both complete logical backups are stored outside Git under
  `.sites-runtime/backups`, directories 0700, files 0600. Snapshot, manifest
  and file checksums were verified. Both data inventories were restored in
  isolation from trusted committed SQL.
- The protected final report is under `.sites-runtime/transfer-reports`.
  It contains backup references, schema proof, reconciliation and timestamps;
  no private records are included in the repository or PR text.

## Data and identity reconciliation

Source and target each contain 19 logical tables and accessible migration
history. The source uses `__appgarden_migrations`, the target `d1_migrations`;
both histories prove exactly the 13 committed migrations. Original source
history is archived and was not written over target history. Provider-internal
`_cf_*` tables are blocked for SQL access and explicitly documented as excluded
platform data.

| Inventory                                       | Verified result                                             |
| ----------------------------------------------- | ----------------------------------------------------------- |
| Source records                                  | 386                                                         |
| Added target records                            | 35                                                          |
| Workshop profiles                               | 163 completely identical, approval status/sources preserved |
| Review sources                                  | 87 completely identical                                     |
| Google mappings                                 | 88 matching identifiers/Place IDs                           |
| Admin roles                                     | 3 transferred unchanged                                     |
| Sessions                                        | 16 transferred unchanged                                    |
| Active login configuration                      | 1 transferred unchanged                                     |
| Confirmed legacy links                          | 0; no mapping invented from matching email addresses        |
| Visits, deletion/upload states, business drafts | Fully reconciled, each empty                                |
| Private R2 files                                | Both complete inventories empty, no missing references      |

All roles and sessions belong to the unchanged Supabase project namespace.
Account identifiers, moderation rights and status were transferred byte-for-byte.
No existing business data record was replaced. The 48 explicitly reported
equivalent metadata entries concern only the import timestamp and already
validated Google cache; original values remain in the protected source backup.
Quota counters and business data do not fall under this exception.
Before and after insert sections, source and target were fully rechecked;
a repeated plan finds no missing source records.

## Authentication and private access on the actual target

15 contract checks were performed on the owned Worker with three exclusively
temporary Supabase test accounts. The provider generated no emails; the private
PNG submission was never published and generated no delivery event.

Checks covered anonymous and forged native headers, regular accounts without
administrative rights, authenticated administration and moderation list, shared
login with a preserved return target, own private visit/file access, foreign
and anonymous access, administrative file access, absence from public display,
account blocking with session revocation, login after unblocking, and logout
with revocation. Private file contents exactly matched the test file.

Final cleanup is proven: no temporary provider accounts, no additional roles,
no test visits or upload reservations, and an empty R2 inventory again.
The SDK-specific state of already revoked sessions was handled correctly using
the official `AuthSessionMissingError` class; unknown errors were not broadly
ignored. The three real admin roles and 16 original sessions remain intact.

R2 is private: `r2.dev` disabled, no custom domains. Google OAuth was already
verified with the user on the previous production deployment; additional
domain/callback acceptance and observation after routing cutover belong to #19.
This report does not claim they are complete.

## Resumption and return path

Before the explicitly authorized, precisely bounded lease push, source history
was backed up remotely under `codex/sites-source-backup-e3d92c7` and as a local
Git bundle, and restored. The old publication and all backups are preserved.
The operating guide is in [data-transfer.md](data-transfer.md).

Until #19, Sites remains the sole writer. Freshly verified backups must not be
presented as a permanently synchronized state. Domain cutover requires a final
source/target reconciliation under an announced short write pause.
After cutover, simply routing back to an outdated database is prohibited;
new writes must be transferred back or preserved through a documented forward
fix. #20 starts only after accepted cutover and completion of the
observation/fallback period.
