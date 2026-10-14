# Benchmark CI

Use this optional procedure to compare CI orchestration without production writes.
[ci-performance-benchmark.yml](../../.github/workflows/ci-performance-benchmark.yml)
uses read-only repository permission, isolated fixtures and no production secrets.
Never trigger a production release to benchmark.

## Prepare comparable sources

Freeze exact baseline/candidate SHAs. Keep runtime, build config, application,
catalogue, migrations and lockfile inputs identical; review orchestration/script
differences separately. Commands come from `scripts/ci-benchmark-lane.mjs` and the
suite registry. The harness uses another checkout; receipts identify the measured
source, not the harness or PR merge revision.

Use the same Node/Go/npm versions and runner class in every lane/sample. CPUs
and parallelism must be matching positive integers. Match nearest-GiB RAM class
and actual RAM bytes within 0.1%; record image/CPU-model differences rather than
claiming identical VMs. The candidate runs at most three lanes simultaneously.

## Run paired samples

1. After merge, dispatch with `variant`, a 40-character `source-ref`, `cache-state`
   and `experiment`. Before merge, use same-repository PR labels:
   `ci-performance-prime` and `ci-performance-{baseline,candidate}-{cold,warm}`.
   Remove each label after its run starts before retriggering. A new PR HEAD gets
   its own experiment/cache.
2. Run one baseline prime, excluded from results, then at least **five cold and
   ten warm pairs**. Alternate start order and keep sources unchanged. Bound groups
   and record run IDs, order, other CI load and runner-image changes.
3. Cold runs neither restore nor save caches; warm runs require an exact cache hit.
   Share only npm package caches, never installed modules, build outputs or Go caches.
   Record the actual npm CLI and cache path/key, including sanitized target installs.

## Collect and report

```sh
node scripts/ci-performance.mjs collect ramiz4/riparim .agents/ci-performance-results RUN_ID_1 RUN_ID_2
node scripts/ci-performance.mjs report .agents/ci-performance-results/samples.json .agents/ci-performance-results/report.json
```

Collection is read-only and retains REST/log/manifest evidence per run attempt.
Record mixed/incomplete metadata, observer/cache/setup errors, cancellations and
retries as invalid; never silently pool them. Quantiles use successful first
attempts only; report failures/retries separately. Insufficient pairs are incomplete.
Median uses the middle value/pair mean; P95 uses nearest rank.

Measure actual jobs/attempt artifacts, not `updated_at`, without adding overlapping
phases. Report these separately:

- **Active critical path:** longest producer runtime plus the subsequent candidate gate.
- **Runner seconds:** all verification-job runtime, including setup/cache/artifact upload.
- **Wait/span:** creation-to-first-start, first-start-to-last-completion and end-to-end.
  Scheduler delay is span minus active path; inter-job idle is time with no active job.

Linux RSS sums the process tree every 100 ms; it can miss spikes and double-count
shared pages. macOS RSS is unavailable. The benchmark-only import hook counts
actual Next CLI launches because `/proc` titles alone are unreliable. Normal CI
must receive no hook. Observer errors invalidate a sample.

## Decide from results

Require active P50 at least 35% shorter, improved P95, median runner seconds at
most 125% of baseline, and warm P50 ≤240 s/P95 ≤300 s. Record deviations/follow-ups;
a small successful sample proves no general flake guarantee.
The deployed-release target of P50 ≤360 s excludes initial queues/approval waits
and requires separate live observations. [Historical result](../archive/ci-performance.md).
