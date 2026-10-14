# Public CPU and manual delivery: October 11–12, 2026

Historical measurement, not a current Free-plan guarantee. For broader private
paths and cold limits see [Issue #149](issue-149-cpu.md); current mail procedure
is in [mail operations](../operations/mail-transports.md).

Three observed older-Worker `/` requests aborted with `exceededCpu`; filtered
slow homepage requests above 10 ms averaged about 175 ms. This was not the
average visitor request. Local warm workerd reproduced about 25 ms: per-request
React rendering/catalogue serialization, early framework load and full revision
row decoding contributed to the cost.

Public homepage/privacy became data-free DE/SQ/EN release interfaces. Sessions
load separately; explicit WebMCP search alone reads the landing catalogue.
Public asset paths bypass framework loading, catalogue GET uses its shared
response directly, and revisions use a SQL aggregate with immediate live
publication/revision checks. Private pages/RSC were still dynamic at this stage.
The beta.5 asset-sidecar adapter was checked against actual builds.

| Path             | Local active CPU sample/request before |  After |
| ---------------- | -------------------------------------: | -----: |
| `/`              |                                24.8 ms | 2.0 ms |
| `/werkstaetten`  |                                 5.4 ms | 1.8 ms |
| `/api/workshops` |                                 7.7 ms | 3.6 ms |

The same isolated canonical data and blocked providers were used. After a
Cloudflare build, `node scripts/profile-worker-cpu.mjs` writes Inspector profiles
to `work/cpu-profiles/`. Samples exclude network/D1 waiting and are comparative
profiler data, not billing. Cold/private variation means these warm values cannot
prove all production requests meet 10 ms. Main-release logs/CPU remeasurement
remained required; this change did not authorize a plan increase.

Moderation now awaited its first email attempt; failure did not undo approval.
Periodic processing, batch action and polling were removed, with an empty cron
list in deployment. Individual retries remained limited to five after
1/5/15/30/60-minute waits, claimed atomically with lease/wait/attempt checks.
Configuration/recipient failures count; initial send cannot bypass retry limits.
Existing events/payloads stayed intact, Resend bytes within 23 hours, ambiguous
SMTP locked. Node operators must disable old timers. Rollback must preserve
exhausted attempts and manual delivery semantics; no new migration was needed.

References: [CPU limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
