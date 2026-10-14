# Cloudflare Free: CPU and manual email delivery

## Proven bottleneck

Logs from October 11–12, 2026 showed three `exceededCpu` aborts of an older Worker version on `/`. Slow homepage requests above 10 ms averaged about 175 ms. Other affected paths were public APIs, privacy and private account pages. These filtered values are not the average of all visitor requests.

Local real workerd reproduced about 25 ms of active CPU samples per warm homepage request. The previous homepage rendered React and serialized the entire catalogue on every request. The framework handler was also loaded before the public asset path. The catalogue overview read and decoded all published rows for revision checking.

## Change and measurement

- Homepage and privacy are rendered in DE/SQ/EN as release documents containing no data. The header requests personal session data separately; no accounts or visit evidence enter artifacts. The landing catalogue is queried only for an explicitly performed WebMCP search.
- The public asset path no longer loads the React/Vinext framework. A bounded build adapter corrects the relative path of Vinext beta.5's generated asset sidecar in the extracted handler; actual Worker builds check its import and RSC behavior.
- Public catalogue GETs use the same authoritative response function directly. Administrative queries and all write methods remain in the authorized framework path. A guest session without a cookie needs no Auth/React call on the owned Worker; native identity headers cannot create a login there.
- Catalogue revision is compared as one SQL aggregate. Changed or hidden profiles retain immediate D1 status checking and shells containing no data as fallbacks. Unknown page paths are rejected before framework loading. Authenticated pages and RSC stay dynamic.

Comparative measurement with the same isolated canonical data, without production/provider access:

| Path             | Before, active CPU sample/request |  After |
| ---------------- | --------------------------------: | -----: |
| `/`              |                           24.8 ms | 2.0 ms |
| `/werkstaetten`  |                            5.4 ms | 1.8 ms |
| `/api/workshops` |                            7.7 ms | 3.6 ms |

`BUILD_TARGET=cloudflare npm run build`, followed by `node scripts/profile-worker-cpu.mjs`, generates local Inspector profiles under `work/cpu-profiles/`. CPU samples are comparative profiler data, not Cloudflare billing. Network/D1 wait time does not count toward CPU. Measurement variation and cold/private paths permit no guarantee that every production request stays below 10 ms. After the verified main release, reassess the same paths and `exceededCpu` through actual logs; do not preemptively change plans.

## Email delivery without a periodic job

The stored moderation decision is followed by an awaited initial send. Errors do not change approval. There is no cron processing, batch action or UI polling. The explicitly empty cron list removes the previous schedule during release deployment.

A private collapsible administrative overview offers individual retries: at most five in addition to the initial send, after waits of 1, 5, 15, 30 and 60 minutes. Attempt limit, wait and lease are checked atomically when claiming in the database. Configuration/recipient errors also count toward the budget. A new initial send cannot be misused as a periodic retry.

Existing events, attempts and payload bytes are preserved; no new migration. Resend retains original idempotency bytes within 23 hours. Ambiguous SMTP handoffs remain locked. Node release operators must disable existing email timers; an individual retry requires the event ID. A code rollback must not reset exhausted attempts and must account for the intended manual delivery mode.

Sources: [Workers CPU limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [project delivery contract](mail-transports.md).
