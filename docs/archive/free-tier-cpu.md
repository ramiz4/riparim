# Public CPU and manual delivery: October 11–12, 2026

Three older live homepage requests aborted with `exceededCpu`; the filtered slow
requests averaged about 175 ms, not the average visitor request. Isolated warm
workerd samples improved after data-free public interfaces, direct catalogue GETs
and lighter revision checks:

- Homepage: 24.8 → 2.0 ms.
- Catalogue: 5.4 → 1.8 ms.
- Workshops API: 7.7 → 3.6 ms.

Samples excluded network/D1 waiting and were comparative profiling, not billing.
Private/RSC paths remained dynamic then. Cold/private variation prevented a 10 ms
Free-plan guarantee; main-release CPU/log remeasurement remained required.
No plan increase was authorized. Later private-path evidence: [Issue #149](issue-149-cpu.md).

Moderation began awaiting its initial email attempt. Cron, batches and polling
were removed; individual retries retained budgets, payloads, leases and ambiguous
SMTP locks. Rollback must preserve manual delivery and exhausted attempts;
Node operators must disable old timers. No new migration was needed.
Current procedure: [mail operations](../operations/mail-transports.md).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/free-tier-cpu.md).
