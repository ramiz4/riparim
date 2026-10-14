# Sites data transfer: October 4, 2026

[#18](https://github.com/ramiz4/riparim/issues/18) completed at 19:45:56 UTC from
Sites [v1.2.0](https://github.com/ramiz4/riparim/releases/tag/v1.2.0) to owned
[v1.2.3](https://github.com/ramiz4/riparim/releases/tag/v1.2.3), with
[verified CI](https://github.com/ramiz4/riparim/actions/runs/37228912201).
Both protected complete backups passed checksum and isolated recovery checks.

Reconciliation covered 19 logical tables, 386 source rows and 13 migrations;
35 target inserts preserved workshop sources/approvals, Google mappings,
roles, sessions and the existing Supabase namespace. Private-file inventories
were empty. Provider internals were excluded; preserved metadata was reconciled.
No email-based identity links were invented. Original Git history was archived.

Fifteen actual access/login/block/private-file contracts passed using three
temporary accounts; their data/files were removed. No email, public review or
delivery event was generated. Google/domain acceptance was outside this transfer.
Sites resumed as sole writer; the target stayed read-only until the
[next day's cutover](domain-cutover-2026-10-05.md), which required fresh backups
and a final delta. Current procedure: [data transfer](../operations/data-transfer.md).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/data-transfer-2026-10-04.md).
