# CI performance — 2026-10-14

Historical Issue #189 result; current operation is in [CI](../development/ci.md).
Baseline `1648f6b8bc780fce820fd1d937774cf3231248e1`; candidate
`a60aaa387fbe058cc537dd884ecb84b34614c821`. All 423 application inputs, catalogue,
migrations and lockfile matched. Ubuntu 24.04, four CPUs, 16 GiB class,
Node 24.21.0, Go 1.27.1, npm 11.19.0 and target npm 11.21.0.

| Cache | Successful pairs | Active P50 before → after | P95 before → after | Median runner seconds before → after | P50 reduction |
| ----- | ---------------: | ------------------------: | -----------------: | -----------------------------------: | ------------: |
| Cold  |                5 |               475 → 212 s |        484 → 226 s |                          475 → 520 s |         55.4% |
| Warm  |               10 |             423.5 → 217 s |        474 → 233 s |                      423.5 → 493.5 s |         48.8% |

All 30 first attempts passed: no failures, invalid samples or retries; prime excluded.
Warm lanes hit the exact package cache; cold restored none. Actual Next builds fell
from three to one. Full verification/gate and runner costs count. Median runner cost
rose 9.5% cold/16.5% warm, below 25%; warm P50/P95 met 240/300 s budgets.

## Evidence and limits

[Raw results](../ci-performance-results.json) retain run links, digests, capacities,
versions and reproducible report; Actions artifacts retain original logs/phases.
The rejected workflow-definition [run 38549303157](https://github.com/ramiz4/riparim/actions/runs/38549303157)
is outside the valid series. Later capacity correction only changed offline validation,
not measured programs/times. No additional attempts began after requested completion;
already authorized runs completed during final verification.

Prime/first cold pair overlapped; later groups were bounded and additional waits/load
recorded. Runner images changed `20261004.327.1` → `20261012.334.1`, CPU models varied:
comparison is the same runner class, not identical VMs. Hooks/RSS observers ran in
both variants; candidate additionally checked workflows/new regressions.
Application inventory excludes only package scripts, not runtime/build config;
full tracked input inventory exposes all orchestration changes. Receipts match each
measured source, not the harness/PR merge revision. Exact cache paths/keys and
sanitized target npm installations were verified.

Active critical path excludes queue waits; total runner seconds include setup/cache/
artifact uploads/gate. Linux process-tree RSS sums at 100 ms can miss spikes/count
shared pages twice; it is neither individual GNU MaxRSS nor a container limit.
The successful sample proves no general flake guarantee. No production deployment
was performed, so release-path P50 ≤360 s remains unverified by this benchmark.

References: [GitHub job API](https://docs.github.com/en/rest/actions/workflow-jobs),
[cache path/version binding](https://github.com/actions/cache#cache-version),
[actionlint 1.7.12](https://github.com/rhysd/actionlint/blob/v1.7.12/docs/usage.md).
