# Controlled retirement of the previous Sites publication

This guide implements [#20](https://github.com/ramiz4/riparim/issues/20) after
[technical production acceptance](domain-cutover-2026-10-05.md).
Status on October 5, 2026: inventory, protected complete archive and retirement
are verified. The user explicitly ended the separate fallback period with
“Ja, jetzt stilllegen.” (“Yes, retire it now.”); the operator decision was
recorded at 09:51:01
Europe/Belgrade (07:51:01 UTC). Execution and follow-up checks are in the
completion evidence below. This superseded the earlier proposed date of
October 6, 05:00; it triggers no further automatic change.

## Inventory and independence of the new operation

| Old inventory         | Inventory before execution                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Hosting project       | `appgprj_6abfd028b7e48191822a15d44cbbda8d`, active, operator is owner                                                   |
| Generated URL         | `https://mjeshter-kosovo.r-loki.chatgpt.site`, HTTP 503 with actual maintenance text and `no-store`                     |
| Stored publication    | Version 42, `bf0af1913102710925efcadbfa9d3fff7631b694`, verified Sites release v1.2.0                                   |
| Provider Worker       | `site---6abfd028b7e48191822a15d44cbbda8d`                                                                               |
| Old domain mappings   | Apex `appgdom_6ac0ffb23eb481919cf1ad20c799ecae`; www `appgdom_6ac0ffd2de708191ab09da6e4a896478`                         |
| D1                    | Logical `DB` binding; 17 application tables plus two archived system tables, 386 rows total                             |
| Private R2            | Logical `BUCKET` binding; fully inventoried, zero objects and evidence references                                       |
| Runtime configuration | Revision 17, 13 variables; `MIGRATION_READ_ONLY=true` is preserved                                                      |
| Background work       | No linked Sites automations in native query; stored five-minute cron skips all notification work through read-only mode |
| Historical source     | Original e3 state with full Git history and BF0 release tag backed up separately                                        |

Production Worker `riparim` runs in the owned account
`ec181b3a61c7c3da13910600953fc3ea` on `https://riparim.com`.
It alone uses `riparim-production` / `b395ea3a-5316-4b0b-bdee-533bdb68d6a0`
and private bucket `riparim-evidence-production`. Enabled owned custom domains
are in zone `cb2470c7a7d49b8a3e6aa3e697c3355e`.
Old Sites domain mappings are separate provider objects, not owned Worker routes.

Active release is v1.2.9 / `53ae6ce7a896e779b75e5f249d25b7993c8c12d4`.
Further main commits containing only documentation or tests forced no new
release. The [main run](https://github.com/ramiz4/riparim/actions/runs/37269913883)
repaired after a faulty ordering test is fully green. Native Sites tokens and
platform identity headers are no dependency of the owned Worker; its ingress
removes forged platform headers. Supabase, Google and Resend remain shared services.

## Protected recoverable complete archive

Archive identifier: `aa0d0eaf-05fe-4c62-a19b-b3a6e60849a9`.
The AES-256-GCM file is stored outside managed task worktrees in a private
directory and additionally as an encrypted document in the existing project
vault. The random 256-bit key is stored in a separate protected vault entry.
Paths and vault references are in the private archive receipt;
no keys or records are stored in Git.

Ciphertext SHA-256:
`5af82e3e8caf6ad481e8c66b7b417f2bf4225e47893ca0fb2e4307747f2941be`.

The archive contains:

- The fresh authenticated frozen source export, snapshot, complete private R2
  manifest and completion receipt. All 19 tables and 386 rows, including
  ownership, approval status and migration history, are preserved;
  the empty R2 inventory is explicitly proven.
- The 13 runtime variables and recovery provenance. The native API masks secret
  values; required current values therefore come from the existing protected
  project vault. The active export hash was proven through authenticated export.
  The existing Resend variable refers there to the `api key` field.
  Shared credentials are rechecked for validity before reuse;
  expired export access is not reactivated.
- Native project/access/domain/version metadata, DNS fallback inventory and
  complete final reconciliation from #19.
- Unchanged GitHub Sites archive v1.2.0 with provenance: SHA-256
  `26ba05a8ef7190479d07cd5e4ff3258f0cd234e2c749f750873b8e8ddbdf9cf8`.
- The exactly reconstructed native version-42 TAR: SHA-256
  `e83f183cd41920a31d4178548cbd73c8c68a5b8974c7743cb08087e7d9072459`,
  6,154,240 bytes, 254 files. It was reconstructed from trusted release files;
  it is no provider download. All paths and content hashes are identical.
  Differences from the gzip container concern only canonical TAR representation:
  sorted regular files, no directory entries, zero UID/GID/mtime, empty owner
  names, mode `0644`.
- Two complete Git bundles: original state
  `e3d92c79da31bdf392a64c14d319eefb4aeca92b` on the explicitly selected branch
  `codex/sites-source-backup-e3d92c7`, and release tag v1.2.0 / BF0.

**Actually verified:** key reread from vault, local ciphertext file decrypted,
all 15 manifested payload files hashed, snapshot revalidated and source database
restored in memory. All 13 migrations, integrity and foreign key checks passed.
The uploaded encrypted document file was downloaded separately; its hash matches
exactly. Temporary plaintext directories and key files were removed after
successful checking. Previous protected task backups remain until safe handover.

The responsible owner is the Riparim operator under existing project access.
Technical minimum retention: **30 days, at least until November 4, 2026** for
archive, recovery keys and old platform resources. The date triggers no automatic
deletion. Final deletion requires a separate explicit authorization afterward.
Extended retention remains possible.

## Verified execution plan

Available native tools offer no unpublish, suspend or deletion of the complete
project. The executable plan therefore reversibly locks the old public
publication and preserves project, versions, D1 and R2.

1. Immediately beforehand check production release, HTTPS and both owned Worker
   domains. Archive/vault readback and current source inventory must match.
   Source remains read-only; a reactivated or changed source is a stop condition.
   Record time and decision ending the fallback period in the execution receipt.
2. `sites_get_site` must confirm owner access and available `custom` mode.
   Current inventory includes only the owner and no additional editor/group
   access. `sites_update_site_access` sets `access_mode: custom` with empty
   visitor/group lists. Native access policy preserves owner authorization;
   afterward reread policy and check anonymous access.
3. Take old source domain IDs from a fresh `sites_list_custom_domains` response
   and remove only those two mappings with `sites_remove_custom_domain`.
   Then prove an empty source list and unchanged owned Worker domains/TLS.
   Owned DNS records, nameservers, email and verification records are not edited.
4. Remove only old export variables: `MIGRATION_EXPORT_TOKEN_SHA256`,
   `MIGRATION_EXPORT_EXPIRES_AT`, `MIGRATION_SOURCE_COMMIT`.
   `MIGRATION_READ_ONLY=true` and all shared application values remain.
   A new environment revision applies only after deployment; therefore redeploy
   the already stored verified version 42 with `sites_deploy_private_site_version`
   after confirming owner-only access. No feature branch or newly built archive
   is published.
5. Prove successful deployment with the new active revision. Export access
   rejected, old public URL no longer publicly accessible, source still
   write-locked, owner access and versions/D1/R2 preserved.
   The physical cron remains part of archived code; its business work is
   permanently disabled by read-only mode. Freshly reread native project
   automations; unexpected active tasks stop the plan.
6. Final production tests: apex/www/HTTPS and release marker, email and Google
   login/logout, administration, permitted own/admin access to private test
   evidence and rejected foreign/anonymous access. Use only marked synthetic
   data and prove complete cleanup.
7. Add actual steps, times, policy revision, deployment, remaining resources
   and limitations. Only then close #20 and check parent completion in #17.

No shared Supabase/Google/Resend values, owned Cloudflare deployment token or
general Sites connection are revoked. Short-lived old Git/export access is
handled according to its proven expiry/binding state; missing token inventory
capabilities are not presented as completed revocation. Project-bound native
owner access is preserved for retention and recovery.

## Recovery and safe interruption

Read the encrypted document and associated recovery entry through existing vault
access. First verify ciphertext hash, then decrypt AES-GCM with documented
format `RIPARIM-SITES-AES256GCM-V1` and verify all manifested file hashes.
Source snapshot, manifest and migrations are first validated only locally with
existing `loadVerifiedSourceBackup`/`restoreSnapshot` checks.
For the original Git bundle, explicitly select the backup branch;
an unproven bare-repository HEAD is not lost source code.
BF0 code is selected through the release tag.

An activation failure on the owned Worker is preferably resolved through a
reviewed forward fix on main. A code rollback resets no D1/R2 data.
The frozen source may return as writer only after an announced write pause on
both sides, fresh backups, complete verified reverse transfer of all new data,
changes, deletions and files, and renewed Auth/permission checking.
Merely reopening the old audience or routing back to its outdated inventory
is not authorized.

On a missing acknowledgment or unknown API/vault response, pause the dependent
step, freshly check existing journals/objects and make no blind retry.
Owned Worker resources and new user data are preserved.

## Completion evidence from October 5, 2026

The authorized fallback period has ended. The old **public** publication is
retired in a controlled manner; the active hosting project and physical resources
remain for retention. This is no project deletion.
Execution ran from 09:52:54 to 09:58:38 Europe/Belgrade; follow-up checks then
occurred without a public maintenance pause.

| Actually executed          | Result                                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source access              | `custom`, policy revision 3; exactly one owner, zero nonowners and groups; current operator remains owner                                                              |
| Old domain mappings        | Only both inventoried source IDs removed; fresh source list empty                                                                                                      |
| Owned domain configuration | Both original owned Worker domain IDs, zone, enabled state and disabled previews unchanged                                                                             |
| Old export values          | Only `MIGRATION_EXPORT_TOKEN_SHA256`, `MIGRATION_EXPORT_EXPIRES_AT`, `MIGRATION_SOURCE_COMMIT` removed                                                                 |
| Active source runtime      | Environment revision 18; `MIGRATION_READ_ONLY=true`; other entries unchanged                                                                                           |
| Private deployment         | Stored verified version 42 / BF0; deployment `appgdep_6ac358569efc8191b9841848bccea8b5` successful with revision 18                                                    |
| Old public access          | Generated root URL and export path return HTTP 401 anonymously                                                                                                         |
| Preserved source resources | Project active and owner-accessible, versions unchanged, logical D1 binding with all 17 application tables present; private files fully archived, no resources deleted |
| Background work            | Zero linked Sites automations; physical source cron remains archived, all business work locked through read-only mode                                                  |

After each routing step, new production still served HTTP 200 on apex and
HTTP 308 with preserved query on www, each with the unchanged v1.2.9 release
commit. There was no further public maintenance pause.

**Follow-up checks actually passed:** five production preflights and 15
Auth/permission checks at 10:02:59 Europe/Belgrade.
Email/password login, session revocation on blocking and logout, new login after
unblocking, administrative rights, private PNG file access for owner/admin,
rejected foreign/anonymous access and exclusion of the pending visit from public
reviews work on the owned Worker. No actual emails were sent.

Three marked synthetic accounts, their data and private file are fully removed:
zero remaining accounts, zero cleanup errors, R2 inventory then zero objects.
Shared IP limits were preserved.
Private check journal: `1ed4fac9-7739-42da-ae97-709d36d7b6f8`.

Actual Google login on riparim.com was also repeated: return to
`/werkstaetten?ort=prishtina`, existing admin menu entry, reachable administrative
page and subsequent logout to the guest login page.
Browser log: zero errors, no #33 navigation error.
No actual user or moderation data was changed.

Shared Supabase, Google, Resend and owned CI access was neither revoked nor
reconfigured. Only old source export access is removed from active runtime.
The general Sites connection and native owner identity remain for other Sites
and recovery. Earlier short-lived Git write access is not claimed permanently
revoked; no new source write access was created for retirement.
Production operation needs no old Git connection.

Archive and resource retention until at least November 4 remains valid.
No final deletion was authorized or performed. After safe handover, own task
worktrees may be archived; required ignored backups remain separately secured
beforehand. Actual archival and remaining resources thus form the documented
handover for #20.
