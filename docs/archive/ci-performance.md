# CI performance: October 14, 2026

Issue #189 compared matching application, catalogue, migration and lockfile inputs.
Five cold and ten warm pairs passed on the same hosted-runner class; all 30 first
attempts succeeded and the cache-prime run was excluded.

| Cache | Active P50 before → after | P95 before → after | Runner cost increase |
| ----- | ------------------------- | ------------------ | -------------------- |
| Cold  | 475 → 212 s               | 484 → 226 s        | 9.5%                 |
| Warm  | 423.5 → 217 s             | 474 → 233 s        | 16.5%                |

Next builds fell from three to one. Warm runtime and the 25% runner-cost budget
were met. [Raw results](../ci-performance-results.json) retain sources, runs,
versions, inventories and observer evidence.

Active runtime excludes queue waits. Runner images and CPU models varied;
100 ms RSS samples can miss spikes and double-count shared memory. These samples
prove no general flake guarantee. No production deployment was measured, so the
release-path target of P50 ≤360 s remained unverified. Use [CI](../development/ci.md)
and [benchmark procedure](../development/ci-benchmark.md) for new measurements.

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/ci-performance.md).
