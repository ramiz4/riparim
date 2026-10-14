# CI

[ci.yml](../../.github/workflows/ci.yml) runs three verification branches:
`quality` (core/types/lint), `node` (one build, two integrations), and `workers`
(Cloudflare/Sites builds). `Tests, types, lint and build` requires all three.
Each installs the root lock with `npm run install:ci`; the gate needs no dependencies.
See [testing](testing.md) for local commands and [releases](../operations/releases.md)
for serialized production verification/publication/deployment.

## Locked tool jobs

Only PR title, release and deploy jobs use private manifests/locks in `.github/tools/`:

| Profile   | Direct root-pinned tools                                         |
| --------- | ---------------------------------------------------------------- |
| `title`   | `@commitlint/cli`, `@commitlint/config-conventional`             |
| `release` | `semantic-release`, `conventional-changelog-conventionalcommits` |
| `deploy`  | `wrangler`, `esbuild`                                            |

`npm run install:tool -- <profile>` requires a clean checkout without root
`node_modules`; it validates root pins/lock entries, installs locked tools and links
root module paths. Existing directories/dangling links are rejected. Update root pins,
matching manifest/lock and deploy overrides together; never use unversioned `npx`.
Deploy needs esbuild for catalogue-plan source verification and retains native-binary
policy/Miniflare sharp override. Complete transitive Commitlint/release dependencies remain.
`node scripts/check-tool-install.mjs <profile>` checks real tools/config offline,
without publication, migration or provider requests. [Install results](../archive/ci-tool-installs.md).

## Benchmark verification, without production

`ci-performance-benchmark.yml` uses `contents: read`, isolated fixtures, no production
secrets or live writes. Baseline is one serial runner; candidate is three branches
plus its gate. Commands/groups come from `scripts/ci-benchmark-lane.mjs` and the suite
registry. Sources are exact frozen SHAs; keep runtime/application/catalogue/migration/
lockfile inputs identical and review orchestration/script differences separately.
Harness lives in a second checkout; receipts stay bound to measured source.

After merge, dispatch with `variant`, exact 40-character `source-ref`, `cache-state`,
`experiment`. Before merge, same-repository PR labels trigger samples:
`ci-performance-prime`, `ci-performance-{baseline,candidate}-{cold,warm}`.
Remove each label after its run starts to allow another trigger. New PR HEAD creates
its own experiment/cache. Never trigger the production release for benchmarking.

Run baseline prime once (excluded), then at least five cold and ten warm pairs.
Alternate start order, keep sources unchanged, record run IDs/order, other CI load
and runner image changes. Bound sample groups; a candidate uses at most three lanes
simultaneously. Cold neither restores nor saves; warm requires an exact cache hit.
Only npm packages are shared, not installed modules/build outputs/Go caches.
Metadata binds cache path/key and actual npm CLI, including sanitized target installs.

```sh
node scripts/ci-performance.mjs collect ramiz4/riparim .agents/ci-performance-results RUN_ID_1 RUN_ID_2
node scripts/ci-performance.mjs report .agents/ci-performance-results/samples.json .agents/ci-performance-results/report.json
```

Collection is read-only, retaining raw REST/log/manifest evidence by run attempt;
no labels/runs are changed. Mixed/incomplete metadata, cache/setup errors,
cancellations and retries are recorded as invalid, never silently pooled. Quantiles
count successful first attempts only; report failures/retries separately. Median is
middle/mean of middle pair, P95 nearest rank; fewer required samples is incomplete.

| Metric                           | Meaning                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| Active critical path             | Max producer runtime plus subsequent candidate gate             |
| Runner seconds                   | Sum of verification jobs, including setup/cache/artifact upload |
| Initial wait                     | Creation to first job start, including harness planning         |
| Execution span / scheduler delay | First start to last completion / span minus active path         |
| Inter-job idle / end-to-end      | Time with no active job / creation to last completion           |

Use actual jobs/attempt artifacts, not `updated_at`; avoid adding overlapping phases.
Capacities/versions/runner class must match across every lane/sample: positive integer
CPUs/parallelism, nearest-GiB RAM class and actual bytes within 0.1%. CPU models/images
remain recorded; hosted runner class does not imply identical machines.
Linux RSS samples sum the process tree every 100 ms, potentially missing spikes and
counting shared pages twice; macOS reports it unavailable. Observer errors invalidate
samples. Count actual Next CLI launches with the benchmark-only import hook; `/proc`
command lines alone lose Next's overwritten title. Normal CI receives no hook.

Targets: active P50 at least 35% shorter, improved P95, median runner seconds ≤125%
of baseline; warm P50 ≤240 s/P95 ≤300 s. Actual deployed release P50 ≤360 s excludes
initial queue/approval waits and needs separate live observations. Record deviations
and follow-ups; small successful samples prove no general flake guarantee.
[Historical result](../archive/ci-performance.md).

## Naming and workflow checks

Use unique ASCII `Category: Purpose` workflow names and contextual `run-name`;
filenames stay stable API/monitor identities. Preserve external check names exactly:
`Tests, types, lint and build`, `Conventional PR title`, and
`Verify merged main / Tests, types, lint and build`. Monitor logical labels
`Supabase Auth Backup`/`Platform Backup` also remain stable.
`tests/ci-workflow.test.mjs` enforces names/triggers. Quality and benchmarks use
`scripts/check-workflows.sh`: SHA-256-pinned actionlint 1.7.12; only optional
ShellCheck/Pyflakes integrations are disabled.
