# Production handover — October 5, 2026

Historical completion of [#17](https://github.com/ramiz4/riparim/issues/17):
[data transfer #18](data-transfer-2026-10-04.md),
[domain/Auth cutover #19](domain-cutover-2026-10-05.md),
[public Sites retirement #20](sites-retirement-2026-10-05.md).
All local times use Europe/Belgrade (UTC+02:00).

## Accepted result

- Verified immutable release [v1.2.9](https://github.com/ramiz4/riparim/releases/tag/v1.2.9),
  commit `53ae6ce7a896e779b75e5f249d25b7993c8c12d4`, archive SHA-256
  `f3bd2b57c03e7f42c192bbdde92f4d0ebb17b6ee3a7984bfd30b83a2093a1353`.
- [Production run](https://github.com/ramiz4/riparim/actions/runs/37260211387)
  succeeded; later [main run](https://github.com/ramiz4/riparim/actions/runs/37282985174)
  passed with deployment skipped because documentation/tests created no release.
- 19 logical tables, 386 source rows, 13 verified migrations; sources, approvals,
  ownership, three admin roles, 16 sessions and Auth configuration preserved.
  Full backups/recovery and empty private-file inventory verified.
- Final three-way delta was a no-op. Existing Supabase identity remained; zero
  legacy links were invented. Actual private access/block/session contracts passed.
- HTTPS apex/www, path/query redirect, direct Google ownership file, actual Google
  login/admin/logout and customer navigation passed.
- v1.2.7–v1.2.9 automatically deployed to the same domain with fixed bindings and
  verified provenance; publication was serialized and retained exact retry bytes.

## Recovery boundary

The first No-Go resumed the unchanged source at 01:03:38 before target writes.
Since **04:57:35**, owned D1/R2 is the sole authoritative write inventory.
Code rollback cannot reset it. PRs #38/#39 proved the forward-fix path.

Reverse transfer to used Sites was neither implemented nor tested.
Any future return requires a newly announced write pause, fresh backups, complete
verified reverse reconciliation of new writes/deletions/files and renewed permissions.
An outdated Site cannot be activated as an immediate automated fallback.

At **09:51:01**, the user explicitly ended the fallback period; retirement completed
at **09:58:38**. Old publication became owner-only, domain mappings/export access
were removed, and the source remained write-locked. Shared Auth/Google/mail/CI
services and native owner access remained intact.

## Verification and retention

Cutover observation lasted **2h18m49s**, with 584 fetch/27 scheduled invocations,
no Worker errors or HTTP 5xx. After retirement, five preflights and 15 actual
Auth/private-file checks passed again at **10:02:59**. Three synthetic accounts,
their data and PNG were fully removed; no actual email/review moderation occurred.
Final anonymous old-Site access returned HTTP 401; production retained v1.2.9.

Encrypted complete source archives and separate recovery keys were verified locally
and in the project vault. Archive, keys, old versions/resources remain **at least
until November 4, 2026**. This date authorizes no automatic/final deletion.
Private journals stay outside Git and must survive task-worktree cleanup.
This record itself changed no production code/schema/data; the dated reports hold
execution evidence and limits. [Current release procedure](../operations/releases.md).
