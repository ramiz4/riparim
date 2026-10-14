# Sites data transfer — October 4, 2026

Historical acceptance for [#18](https://github.com/ramiz4/riparim/issues/18).
Import completed **19:45:56 UTC**. Sites resumed as sole writer afterward;
the owned target stayed read-only until [the next day's cutover](domain-cutover-2026-10-05.md).
This record does not describe current production state.

## Release and backup evidence

- Source: unchanged Sites archive [v1.2.0](https://github.com/ramiz4/riparim/releases/tag/v1.2.0),
  `bf0af1913102710925efcadbfa9d3fff7631b694`, version 42.
- Target/tools: [v1.2.3](https://github.com/ramiz4/riparim/releases/tag/v1.2.3),
  `03bce9429492519de1af7067bca240eca9f53395`;
  [verified run](https://github.com/ramiz4/riparim/actions/runs/37228912201).
- Reviewed corrections: PRs [#27](https://github.com/ramiz4/riparim/pull/27),
  [#28](https://github.com/ramiz4/riparim/pull/28), [#30](https://github.com/ramiz4/riparim/pull/30).
- Both protected complete backups had verified checksums and isolated recovery
  from committed SQL; private receipts remain outside Git.
- Original history was preserved on `codex/sites-source-backup-e3d92c7` and in a
  restored Git bundle before the explicitly authorized bounded lease push.

## Reconciliation

| Inventory                                       | Verified result                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| Logical tables / migrations                     | 19 / 13; source `__appgarden_migrations`, target `d1_migrations` |
| Source rows / target inserts                    | 386 / 35                                                         |
| Workshops / review sources                      | 163 / 87, identical sources and approval status                  |
| Google mappings                                 | 88 matching IDs/Place IDs                                        |
| Admin roles / sessions / Auth configuration     | 3 / 16 / 1, unchanged Supabase namespace                         |
| Confirmed legacy links                          | 0; no email-based mapping                                        |
| Visits, upload/deletion states, business drafts | Fully reconciled, empty                                          |
| Private objects/references                      | Complete empty inventories; no missing files                     |

Source history remained archived; target history was preserved. `_cf_*` provider
internals were explicitly excluded. The 48 equivalent cache/import metadata entries
preserved target values; no quota or business-data exception. Before/after sections
and a repeated empty insert plan verified completion.

## Actual access checks and limits

Fifteen actual target contracts passed with three temporary Supabase accounts:
admin/customer/anonymous and forged-header permissions, login/return/logout,
own/admin private PNG access, denied foreign/anonymous access, draft exclusion,
blocking/session revocation and new login after unblocking.
All test accounts/data/files were removed; original roles/sessions remained.
No provider email, published review or delivery event was generated.

R2 privacy was verified (`r2.dev`/file domains disabled).
Actual Google/domain acceptance and later observation belonged to #19;
this transfer alone did not prove them. The responsible execution/operator agent
recorded Go for data transfer only. New domain cutover required fresh backups and
final delta under an announced write pause. [Current transfer procedure](../operations/data-transfer.md).
