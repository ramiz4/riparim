# Private-page CPU evidence: October 12, 2026 (#149)

The accepted task optimized production and documented Free limits, without a
10 ms guarantee. Plan and `limits.cpu_ms:500` from #151 stayed unchanged;
success under that limit does not prove Free suitability. Historical measurements:

## Live before baseline

v1.21.4, commit `70d9be959166eef7c08f729ef8de7b407c70cbb1`, Worker
`c4cd2de2-7f12-4465-9de1-5a3ba8f87a4f`, active 13:34:08 UTC. Controlled GETs
at 15:35–15:37 sent one first-observed plus 30 warm requests per case; all were
HTTP200 with matching release. Cloudflare `cpu_time_ms` adaptively weighted counts.
A first observation was not a proven cold isolate; network time was not CPU.

| Guest route/format                      | Warm median / p95 / max ms | First observed ms |
| --------------------------------------- | -------------------------: | ----------------: |
| `/` HTML                                |                  0 / 1 / 1 |                 4 |
| `/anmelden` HTML                        |               23 / 43 / 62 |               174 |
| `/betrieb` HTML                         |               34 / 50 / 73 |                49 |
| `/bewertungen` HTML                     |               23 / 33 / 35 |                29 |
| `/einstellungen` HTML                   |               17 / 26 / 27 |                71 |
| `/werkstaetten` RSC                     |            140 / 176 / 179 |               128 |
| `/betrieb` RSC                          |               15 / 22 / 45 |                21 |
| `/api/session` JSON, meaningless cookie |                 6 / 9 / 28 |                13 |
| `/api/workshops` JSON                   |                6 / 10 / 18 |                12 |

RSC used the canonical empty `?_rsc`; 307 redirects from nonempty probes were
excluded. Catalogue RSC was ~342 KB, JSON ~225 KB. Signed-in business had first
154 ms, then ten tail-captured requests median 33.5/p95-max 63 ms. Signed-in
session was 44 ms once, insufficient for a warm distribution.

## Cause, change and local after measurements

Isolated workerd found catalogue serialization at 62–66 ms warm and private
pages carrying editing catalogues. One session read made three provider calls.
Data-free release interfaces and shared direct authorized GET functions removed
React from those reads. Provider validation is shared only within one request;
revocation/blocks/roles remain checked each request. Strict cookie optimization
kept SDK refresh/write/deletion contracts and invalid-input fallback.

The measured build integrated v1.23.0 `c0bf92b851beb3d5db7f288dd05bcb27d65b314a`
and three review corrections. Module-inventory SHA-256:
`bce84bb7b9ae20b8650c91ecd19cbf0842ddefe0664b1b6a214b27661338b946`.
Corrected audience/UUID-session JWT fixtures, populated own/legacy/foreign data,
three fresh isolates and 30 warm calls per case produced:

| Signed-in GET   | Cold median / max ms | Warm median / p95 / max ms |
| --------------- | -------------------: | -------------------------: |
| `/api/session`  |        13.27 / 17.31 |         2.65 / 4.02 / 4.78 |
| `/api/business` |        13.89 / 18.88 |         4.20 / 5.86 / 6.62 |
| `/api/visits`   |         9.60 / 10.05 |         3.01 / 5.08 / 5.44 |
| `/api/account`  |        10.72 / 14.58 |         2.89 / 5.08 / 5.21 |

Expired refresh cold median/max 15.17 ms; first legacy link 10.27/13.40;
provider outage 9.96/10.45. Guest APIs cold/warm max 6.45/2.09.
Catalogue RSC shrank to 19,620 bytes: cold 4.06/5.65, warm 0/1.13/1.40.
An unchanged `70d9be9` archive measured signed-in review interface at cold/warm
87.92/47.16 medians, versus new 3.98/0. Zero Inspector samples do not mean zero
CPU. These are interface/API measurements, not combined navigation totals.
Small populated responses and a separate 51-record pagination test did not prove
large production inventory performance. Cold authenticated APIs still exceeded 10 ms.

```sh
CPU_PROFILE_POPULATED=1 CPU_PROFILE_COLD=3 CPU_PROFILE_SAMPLES=30 \
  CPU_PROFILE_CASES=/api/session,/api/business,/api/visits,/api/account \
  node scripts/profile-worker-cpu.mjs
```

The profiler records artifact/fixture/raw samples/provider calls after a build.
It excludes module initialization, blocks providers and is not billing; live
remeasurement remained required. Local DE/SQ/EN browser/theme/keyboard checks
passed at 390/1280; query/focus/late-answer/account fixes had regressions.

## Cron observation and limits

Empty schedules coexisted with 20 older timer/missing-handler events at 09:30–11:10
UTC. None followed through 16:59 across v1.21.0–v1.23.0, before this task release;
this task did not cause the stop. Delayed reconciliation was plausible, not proven.
After-release interval checks remained required. Mail retained awaited initial send,
five manual retries, payloads/leases/SMTP locks; measurements sent no mail.
