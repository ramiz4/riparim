# Production cutover: October 5, 2026

[#19](https://github.com/ramiz4/riparim/issues/19) moved production to owned D1/R2
as sole writer at 04:57:35 Europe/Belgrade (UTC+02:00). The first attempt stopped
without changes; the accepted window used fresh backups and a no-op final delta.
Only authorized web records changed; mail, verification and Auth identity survived.

[v1.2.9](https://github.com/ramiz4/riparim/releases/tag/v1.2.9) and its
[production run](https://github.com/ramiz4/riparim/actions/runs/37260211387)
passed HTTPS/redirect, Google login/admin/logout, customer navigation and fifteen
actual Auth/private-file checks. Synthetic accounts/data/files were removed.
No actual emails were sent or real reviews moderated.

The 2h18m49s observation recorded 584 fetch and 27 scheduled invocations without
Worker errors or HTTP5xx. This establishes only that interval; the old app cron
was later removed. Technical acceptance did not authorize resource deletion.
The user separately ended fallback at 09:51:01; [Sites retirement](sites-retirement-2026-10-05.md) followed.

Reverse transfer into used Sites was unimplemented and untested. Code rollback
cannot reset newer authoritative data; prefer verified forward fixes.
Current procedure: [domain cutover](../operations/domain-cutover.md).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/domain-cutover-2026-10-05.md).
