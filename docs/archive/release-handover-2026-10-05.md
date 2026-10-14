# Production handover: October 5, 2026

[#17](https://github.com/ramiz4/riparim/issues/17) completed the
[data transfer](data-transfer-2026-10-04.md), [domain/Auth cutover](domain-cutover-2026-10-05.md)
and [public Sites retirement](sites-retirement-2026-10-05.md).
Verified [v1.2.9](https://github.com/ramiz4/riparim/releases/tag/v1.2.9) preserved
sources, approval/ownership, roles, sessions and existing Supabase identity.
Actual Google login, navigation and private-access checks passed; test data was removed.

Owned D1/R2 became the sole writer at 04:57:35 Europe/Belgrade (UTC+02:00).
The source remained write-locked. Code rollback cannot reset the authoritative
inventory; reverse transfer to used Sites was neither implemented nor tested.
Reopening it requires fresh backups, complete reverse reconciliation and renewed permissions.

Public Sites access was disabled reversibly after the user ended fallback.
Encrypted recovery archives and separate keys were verified; the
[retirement record](sites-retirement-2026-10-05.md) governs minimum retention
through November 4 and separate final-deletion authorization.
Observation/access checks covered their stated intervals only; no actual email or
review moderation occurred. This handover itself changed no production data.
Current procedure: [releases](../operations/releases.md).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/release-handover-2026-10-05.md).
