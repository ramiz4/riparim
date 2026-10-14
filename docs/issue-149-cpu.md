# Issue #149: private pages, sessions and RSC

## Binding acceptance target

On October 12, 2026, the requester clarified the completion target:
“Aktuelle Produktion optimieren; Free-Grenzen offen dokumentieren”
(“Optimize current production; document Free limits openly”).
Optimization is therefore accepted against current production.
This task does not guarantee the originally requested reliable compliance with
10 ms on Workers Free. Cold overruns remain explicitly documented below;
the plan and existing 500 ms limit remain unchanged. A reviewed PR, squash
merge, main release, actual live CPU and cron checks remain part of the assignment.

## Comparison baseline on October 12, 2026

Original issue measurements came from v1.20.2. Before implementation, v1.21.4
was already in production: commit `70d9be959166eef7c08f729ef8de7b407c70cbb1`,
Worker version `c4cd2de2-7f12-4465-9de1-5a3ba8f87a4f`, activated at
13:34:08 UTC. The release workflow succeeded. This current version is therefore
the before baseline.

`limits.cpu_ms: 500` comes from the already merged PR #151. This task changes
neither that configuration nor the plan. Assessment against the
[Free budget of 10 ms per HTTP invocation](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)
is independent of it; successful responses under a higher limit do not prove
suitability for Free.

Controlled GETs ran between 15:35 and 15:37 UTC with unique `cpu_probe` markers
containing no data. Each case received a first observed invocation followed by
30 warm invocations. All responses evaluated below were HTTP 200 and contained
the release commit above. A first observed live invocation is not a proven fresh
isolate; an actual cold start is checked separately locally. Network time is not
CPU time.

CPU values come from Cloudflare's `cpu_time_ms` trace field, grouped by route
and marker. Cloudflare weights samples adaptively: aggregated `count` sometimes
differed from the number actually sent. The table therefore shows 30 sent
requests and observed weighted CPU statistics. It claims no complete measurement
of every invocation.

| Route and state                                    | Format | Warm requests sent | Median CPU | p95 CPU | Maximum CPU | First observed invocation |
| -------------------------------------------------- | ------ | -----------------: | ---------: | ------: | ----------: | ------------------------: |
| `/`, guest                                         | HTML   |                 30 |       0 ms |    1 ms |        1 ms |                      4 ms |
| `/anmelden`, guest                                 | HTML   |                 30 |      23 ms |   43 ms |       62 ms |                    174 ms |
| `/betrieb`, guest                                  | HTML   |                 30 |      34 ms |   50 ms |       73 ms |                     49 ms |
| `/bewertungen`, guest                              | HTML   |                 30 |      23 ms |   33 ms |       35 ms |                     29 ms |
| `/einstellungen`, guest                            | HTML   |                 30 |      17 ms |   26 ms |       27 ms |                     71 ms |
| `/werkstaetten`, guest                             | RSC    |                 30 |     140 ms |  176 ms |      179 ms |                    128 ms |
| `/betrieb`, guest                                  | RSC    |                 30 |      15 ms |   22 ms |       45 ms |                     21 ms |
| `/api/session`, guest with meaningless test cookie | JSON   |                 30 |       6 ms |    9 ms |       28 ms |                     13 ms |
| `/api/workshops`, guest                            | JSON   |                 30 |       6 ms |   10 ms |       18 ms |                     12 ms |

RSC was requested separately with `RSC: 1`, `Accept: text/x-component` and the
canonical empty `?_rsc` parameter. Nonempty probe IDs initially produced HTTP 307;
those redirects are explicitly excluded from the RSC table. Catalogue RSC body
size was about 342 KB; the JSON catalogue response about 225 KB.

An existing session provided by the user was then checked without sending email
or making business writes in production. The first observed authenticated
business request used 154 ms CPU. Ten subsequent requests, fully completed with
`networkidle` and individual probe IDs, were fully captured in the real-time tail:
median 33.5 ms, p95/maximum 63 ms. An authenticated direct GET session check used
44 ms (n = 1; no reliable warm sample). Private responses used `private, no-store`.

## Proven causes and verification contract

Isolated real workerd reproduced catalogue RSC at 342–348 KB and about 62–66 ms
of warm active CPU samples. The profiler primarily showed RSC serialization.
Private review pages also transferred the entire editing catalogue.
An authenticated session check called the provider three times: proxy,
route authentication and the SDK's symmetric token verification.

The comparison profiler uses only isolated D1/R2, synthetic sessions and
intercepted provider responses. CPU sampling from the local Inspector is
comparative diagnosis, not Cloudflare billing. Approval for Free additionally
requires actual CPU values from the published main release, including session
state, HTML/RSC, actual navigation and locale changes. Absence of `exceededCpu`
aborts alone is insufficient.

## Implementation and local after measurement

Private HTML/RSC responses contain only release interfaces and localized loading
messages. Sessions, ownership and private data are subsequently loaded through
fresh authorized APIs. Internal artifact paths are blocked on the Worker.
These private responses containing no data also remain `private, no-store`
and `noindex,nofollow`.

```text
HTML / RSC → release interface containing no data
JSON GET   → one provider client per request → current D1 access check
Writes     → existing authorized app routes
```

Session, Auth options, business, review and account reads bypass the React
framework on the owned Worker. App Router and Worker use the same authoritative
GET response functions. This preserves ownership, confirmed legacy links,
cursors, moderation and the already started account deletion flow.
Fresh HTTP requests still check provider, session revocation, account blocks
and role removal. Node/Sites and all write methods retain existing adapters.

The Supabase adapter shares the verified provider response only within a single
HTTP request. A native strictly validated cookie read representation avoids
slow JavaScript Base64 decoding; original chunk names and cookie bytes, SDK
validation, token refresh, write formats and deletion are preserved.
Noncanonical or invalid inputs go unchanged through the previous SDK path.
There is no new dependency, Auth protocol change or task migration.

The public RSC path uses release artifacts with the same current status/revision
and provider checks as HTML. Catalogue RSC serves a compact interface and loads
published records through the existing live API. Private query targets are read
after hydration from the actual URL; the RSC response header carries the current
path and query outside the immutable artifact.

During implementation, the task branch integrated `main` up to
`c0bf92b851beb3d5db7f288dd05bcb27d65b314a` (v1.23.0). The new landing page,
premium features and their already published migration `0019` are preserved.
The subsequently integrated backup monitoring change affects no app runtime
and activates no monitor through this task.

The last measured Cloudflare build contains the integrated `c0bf92b` baseline
plus task changes, including all three review corrections.
SHA-256 of the module inventory using the profiler's hashing method:
`bce84bb7b9ae20b8650c91ecd19cbf0842ddefe0664b1b6a214b27661338b946`.
Final JWT fixtures also use an authenticated audience and UUID session ID;
earlier measurements used a simpler fixture. Each case measured three fresh
workerd isolates and 30 warm invocations. The populated fixture contains own,
confirmed legacy and foreign records, plus a separate 51-record pagination test.
Profiled responses contain about 3 KB of business data, 2.9 KB of reviews and
151 bytes of account state; this does not conclusively verify larger real inventories.

| Signed-in GET   | Cold median / maximum | Warm median / p95 / maximum |
| --------------- | --------------------- | --------------------------- |
| `/api/session`  | 13.27 / 17.31 ms      | 2.65 / 4.02 / 4.78 ms       |
| `/api/business` | 13.89 / 18.88 ms      | 4.20 / 5.86 / 6.62 ms       |
| `/api/visits`   | 9.60 / 10.05 ms       | 3.01 / 5.08 / 5.44 ms       |
| `/api/account`  | 10.72 / 14.58 ms      | 2.89 / 5.08 / 5.21 ms       |

A refreshed expired session used a cold median/maximum of 15.17 ms.
A legacy identity linked for the first time reached 10.27 / 13.40 ms;
a provider outage 9.96 / 10.45 ms. Guest cases for direct private APIs reached
a cold maximum of 6.45 ms, warm maximum 2.09 ms. A guest with a meaningless cookie
reached cold median/maximum 5.36/5.65 ms and warm 1.12/2.05 ms.
Authenticated direct reads require one provider call; refresh requires two.

Before GET extraction, cold medians for business/reviews/account with a populated
fixture were 27.89/23.04/23.92 ms. This earlier task measurement still used
`70d9be9`; the comparison also includes integration of newer main; the JWT fixture
was aligned afterward. The separate original comparison from unchanged Git
archive `70d9be9` shows signed-in reviews at 87.92 ms cold and 47.16 ms warm median;
with the corrected interface they are 3.98 ms cold and 0 ms warm median
(p95 1.29 ms, maximum 1.80 ms). Catalogue RSC body size is now 19,620 bytes;
its guest case needed cold median/maximum 4.06/5.65 ms and warm
median/p95/maximum 0/1.13/1.40 ms. Zero samples mean no active Inspector samples,
not guaranteed absence of CPU usage. These are document values, not sums of
all subsequently loaded API calls.

**Local measurement still does not meet the cold Free headroom requirement.**
Private authenticated APIs and token refresh in particular still exceed 10 ms.
Improved warm values provide no general Free guarantee. Actual Cloudflare CPU
values and larger/private flows must be remeasured after the verified main
release. The plan and existing configured 500 ms limit remain unchanged.

Reproduction after a Cloudflare build:

```sh
CPU_PROFILE_POPULATED=1 CPU_PROFILE_COLD=3 CPU_PROFILE_SAMPLES=30 \
  CPU_PROFILE_CASES=/api/session,/api/business,/api/visits,/api/account \
  node scripts/profile-worker-cpu.mjs
```

The profiler records commit, actual artifact hash, fixture state, cold/warm raw
samples, provider calls, response size and summarized CPU samples.
Module initialization before the Inspector is explicitly excluded;
no live providers or production data are used.

## Browser and contract checks

Browser verification used the user's supplied integrated browser with a
previously verified Riparim account. The local actual Cloudflare application
ran with isolated D1/R2 and synthetic provider responses.
DE/SQ/EN, 390/1280 pixels, light/dark/system themes, keyboard, loading/empty/error
states and rejected administrative access were checked; system theme resolved
to dark here. There was no horizontal overflow.

Native checking first reproduced lost query targets in static RSC interfaces
and lost focus after another session error. Corrected actual navigation preserves
the targeted review and workshop through login, direct access and browser back.
Session retry retains keyboard focus on another error. Public search with
location/service, locale switch and reload preserved filters.
Existing public field boundaries during locale changes remain unchanged.

The first independent architect review also found three errors with retained
client components. Workshop retry now explicitly triggers a new load attempt.
Results belong to the current account and query target; old forms disappear
immediately on change and delayed responses are discarded. Successful name
change or account deletion invalidates the shared session request and updates
public and private displays even without remounting. Old in-flight session
responses cannot overwrite this state. These contracts were first reproduced
with failing tests, then verified successfully. The form area is retained on
account changes; after a successful workshop retry, the main area receives
keyboard focus.

Built Worker contract tests add populated ownership/legacy-link and foreign
cases, pagination, private evidence, moderation, role/session removal, started
locked account deletion, cookie refresh, definitive rejection, provider/database
errors and forged native headers. Existing mutation, SMTP, manual retry and
Node/Sites contracts remain part of regular CI checks. Live measurements send
no actual emails and change no business production data.

## Cron history across all versions

The schedules API returned an empty list during the current inventory check.
Logs were also evaluated without a Worker version filter for service `riparim`
and `$metadata.origin = scheduled`. Between 09:30 and 11:10 UTC, 20 invocation
events from the previous `*/5 * * * *` timer were observed; the last occurred
in the 11:05–11:10 UTC interval. Associated errors reported the missing scheduled
handler. From 11:10 UTC until task start and before measurements, no further
scheduled events were found.

The stop had therefore already occurred before this implementation and persisted
through releases v1.21.0 to v1.21.4. This is observation evidence across versions,
not a repair caused by this task. Logs prove an old timer continued firing despite
an empty control-plane list. Delayed reconciliation is a plausible explanation;
the exact provider-internal sequence cannot be established from available logs.
The last event falls beyond the documented
[propagation time of up to 15 minutes](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
The additional inventory check at 16:59 UTC still showed an empty schedules list
and zero scheduled events or matching handler errors since 11:10 UTC, without
a version filter. Available trigger/handler values in that window were exclusively
`http`/`fetch`; this rules out a mere change in timer representation in the new
trace format as an explanation. The active release was by then v1.23.0 with
Worker version `fefcc17c-cf8d-4b63-b108-c7b5904ef652`, activated at 16:58:22 UTC.
Absence must be checked again over several five-minute intervals after the task
release. No ineffective scheduled handler is introduced.

The email contract remains an awaited initial send and at most five manual
individual retries after 1/5/15/30/60 minutes. Attempt counters, atomic claim,
lease, idempotency and locks on ambiguous SMTP handoff remain authoritative.
Measurements send no actual messages.
