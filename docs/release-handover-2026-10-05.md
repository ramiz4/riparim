# Overall completion of production cutover on October 5, 2026

Follow-up work for [#17](https://github.com/ramiz4/riparim/issues/17) is complete:
[data transfer #18](data-transfer-2026-10-04.md),
[domain/Auth cutover #19](domain-cutover-2026-10-05.md) and
[public Sites retirement #20](sites-retirement.md). Their execution reports
remain authoritative evidence; this report maps them to the parent acceptance
criteria. All local times use Europe/Belgrade (UTC+02:00).

## Met acceptance criteria and proven scope

| Criterion from #17                                 | Actually proven                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified main pipeline and protected configuration | PR #8 and bootstrap fixes integrated; production environment main-only, separate Cloudflare/app secrets and verified fixed bindings.                                                                                                                                                                                                                    |
| Associated immutable release bytes                 | [v1.2.9](https://github.com/ramiz4/riparim/releases/tag/v1.2.9), commit `53ae6ce7a896e779b75e5f249d25b7993c8c12d4`; tag, provenance, archive hash and served `X-Riparim-Release-Commit` match. A retry builds no new archive.                                                                                                                           |
| Fully transfer existing D1/R2 data                 | #18: 19 logical tables, 386 source rows, 13 proven migrations; ownership, approval status and sources preserved. Both R2 inventories were empty; private file flows were checked with isolated PNG data. Complete backups and local recovery passed. #19: final three-way reconciliation, 0 inserts/modifications/deletions; retry verified as a no-op. |
| Identities, sessions and access controls           | Supabase project unchanged; original three admin roles, 16 sessions and active Auth configuration reconciled. Zero existing confirmed legacy links; no email-based mapping invented. Server permissions, blocks, foreign/anonymous private-file access and own/admin access actually checked.                                                           |
| Production domain, Google file and Auth callbacks  | Apex/www with TLS, canonical path/query redirect and direct unchanged Google file; existing runtime values securely transferred. Actual Google login, correct return target, administration and logout on riparim.com passed.                                                                                                                           |
| Go/No-Go and return path                           | First No-Go with actual resumption of unchanged source before target writes; final Go after data/TLS/release reconciliation. Technical acceptance at 07:16:24; the time-limited Sites return path and its explicitly decided end are detailed below.                                                                                                    |
| Further automatic serialized main releases         | v1.2.7–v1.2.9 were published automatically on the same production deployment after domain cutover. Workflow group `production-release`, `cancel-in-progress: false`; exact provenance, fixed resources and precedence of newer fully published releases.                                                                                                |
| Operating documentation including migrations       | [Release operations](releases.md#production-migrations-retries-and-rollback), [transfer/retry](data-transfer.md), [domain cutover](domain-cutover.md) and [archive/retention](sites-retirement.md) contain verified procedures and limitations.                                                                                                         |

Active Worker archive v1.2.9, SHA-256:
`f3bd2b57c03e7f42c192bbdde92f4d0ebb17b6ee3a7984bfd30b83a2093a1353`.
The [automatic production run](https://github.com/ramiz4/riparim/actions/runs/37260211387)
succeeded. Subsequent test/documentation-only commits force no new release.
The [main run after retirement](https://github.com/ramiz4/riparim/actions/runs/37282985174)
also fully succeeded; its deployment job was skipped as intended because there
was no new semantic release.

## Return path before and after writer activation

Before enabling the target writer, the unchanged Sites publication could be
resumed. This concrete path was actually executed at the first No-Go at
01:03:38, without domain/DNS changes or data delta. Since 04:57:35, the owned
Cloudflare inventory is the sole authoritative write source.
A code rollback does not reset this data.

Reverse transfer of new D1/R2 data to Sites is **neither implemented nor tested**
and is not described as an available automated return path. Existing transfer
tools write exclusively to the fixed Cloudflare target. Documented reverse
reconciliation is a prerequisite for any separately prepared return, not an
executed source import. Forward fixes through verified main releases are
actually proven: callback and ownership-file corrections from PR #38/#39 were
published automatically while production was available and then accepted.

The user explicitly ended the original fallback window with “Ja, jetzt stilllegen.”
(“Yes, retire it now.”) at 09:51:01. The old public publication was then locked by 09:58:38, its domain
mappings removed and old export access removed from runtime. This supersedes
the previously unresolved fallback period in the domain report.
The old Site is now retained recovery inventory, not a production target that
can be immediately activated. A future switch back requires fresh backups of
both sides, an announced write pause, complete verified reverse transfer of
new changes/deletions/files and renewed permissions QA.
Without this proof, the owned inventory remains and a forward fix is the
available recovery path.

## Verification, retention and handover

Domain acceptance observed 2 hours, 18 minutes and 49 seconds with 584 fetch
and 27 scheduled invocations, without Worker execution errors or HTTP 5xx.
After retirement, five preflight checks and 15 actual Auth/private-file checks
passed again at 10:02:59. The three marked test accounts, their data and the
private file are fully cleaned up; zero remaining accounts or cleanup errors.
Actual Google login/administration/logout were also checked.
No actual emails were sent or actual reviews moderated.

Fresh public final checks confirm apex and technical host with HTTP 200 and
unchanged v1.2.9 commit, www with HTTP 308 and preserved query, direct Google
verification file with HTTP 200 and unchanged bytes, and old generated URL
anonymously with HTTP 401. They change no data.

Complete encrypted source inventory and separate recovery keys are recoverably
backed up locally outside managed worktrees and in the protected project vault.
Archive, old versions and resources remain **at least until November 4, 2026**;
no automatic or final deletion is authorized. Shared Supabase, Google, Resend
and Cloudflare CI access is preserved. Task worktrees and required private check
journals remain until safe handover.

Completion changes neither production code nor schema or data.
Final documentation undergoes spec/standards review and required GitHub checks;
integration occurs only through a squash PR. The issue sequence ends after its
integration and a fresh GitHub query showing no open issues.
