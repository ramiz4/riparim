# Measure CI performance

Verification has three independent runners: `quality`, `node` and `workers`.
The Node branch builds once and checks the same validated outputs in both
integration suites. The existing `Tests, types, lint and build` gate waits for
all required branches. Release serialization still covers verification,
publication and deployment.

## Controlled comparison

`Benchmark: CI performance` performs only local checks, builds and packaging
with isolated test data. The workflow has only `contents: read`, uses no
production secrets and starts no publication, deployment or live migration.
It has its own concurrency key per run and cancels neither other samples nor
normal CI.

A sample checks either the old serial verification (`baseline`) on one runner
or the new verification (`candidate`) on three independent runners.
A parallel comparison within one runner would not compare the actual job
architecture. Commands are in `scripts/ci-benchmark-lane.mjs`; the centrally
registered `core` and `node` groups remain the source of suite lists.
The baseline run uses its source revision's unchanged commands, including the
three Node builds. The harness starts the identical `tests/run.mjs` entry point
directly with Node: the npm test lifecycle PATH would hide the cache wrapper
behind `node_modules/.bin/npm`. Tests, groups, arguments and suite concurrency
remain identical.
Instrumentation counts actual Next CLI starts with `build --webpack` through a
benchmark-only Node `--import` hook before the main program: three for baseline,
one for candidate. Next overwrites `process.title` before the build, removing its
original Linux command line; periodic `/proc` sampling alone would be unreliable
for this count. The actual `process.argv[1]` entry point is bound by `realpath`
to the installed Next module in the measured checkout. Symlinks in the release
source fixture remain the same module path; unrelated or nested fake builds are
not counted. Each launch log belongs to a profiler phase. Hooks loaded more than
once from source and harness are deduplicated by PID and `performance.timeOrigin`;
worker threads do not count again. Existing `NODE_OPTIONS` are preserved.
The hook is added only to the benchmark profiler's child environment; normal CI
and production do not receive it. The sanitized target installation and its
restricted runtime checks inherit no benchmark `NODE_OPTIONS`.
This also captures builds whose older tests discard stdout; banner counts in
the log remain a separate diagnostic metric.

Both variants use `ubuntu-24.04`, Node **24.21.0** and Go **1.27.1**.
Go is set up only for baseline and `quality`; those run the actual email template
checks. All installations use the locked installer with `HUSKY=0`.
The hook contract itself remains part of the general tests.

For Issue #189, the baseline is
`1648f6b8bc780fce820fd1d937774cf3231248e1`. The candidate is frozen to an exact
commit SHA. `sample.json` records source and harness revisions, Node/npm/Go
versions, runner image and image version, architecture, cache key and cache hit.
Harness files and measurement output live in a second checkout; they modify
neither the measured source tree nor its build receipt. Child commands receive
`GITHUB_SHA=sourceRevision` solely to bind them to their SHA. The actual harness
SHA remains separately in metadata; event and ref are unchanged. This preserves
the packagers' complete clean-source/commit contract and verifies the actually
checked-out measurement revision rather than the PR merge/harness commit.
CPU model, logical CPUs, `availableParallelism()` and total memory are also
recorded. Every lane and sample must have the same positive integer CPU and
parallelism capacities. Memory capacity is compared as the nearest whole GiB
class; actual reported bytes must be positive and finite and differ by at most
**0.1%** from the reference runner. For the 16 GiB class this is approximately
16 MiB. A few kernel-reserved pages, such as an observed difference of 4096
bytes, therefore remain permissible; 4→2 CPUs, 16→8 GiB or substantial changes
within a class are rejected. The check applies to all three candidate lanes and
the complete series, including repeated offline evaluation.
Actual bytes, CPU models and image versions remain in the raw inventory.
Standard hosted runners may use different CPU models; their identity is not
guaranteed. Image class and Node/npm/Go versions must still match.
This tolerance is an offline evaluation validation rule and changes neither
measurement commands nor reported raw values.

`inputInventory` captures every tracked file with SHA-256. A separate application
inventory covers the app, components, libraries, assets, catalogue data, database,
migrations, types, vendor sources and committed runtime/build configurations and
lockfile. For `package.json`, only npm scripts are removed from this inventory.
Catalogue and migration digests are also compared individually. Changes in
`scripts/`, `tests/`, `.github/` and documentation appear in the complete inventory
and must be explained as build/test/orchestration changes in the comparison;
in particular, runtime-relevant script changes require separate review before
the comparison. The complete `sourceDigest` uses the same contract as the Node
receipt and may differ between workflow revisions. A receipt must always match
its own source revision.

## Cold and warm package cache

Every newly provisioned hosted runner uses the dedicated directory
`${runner.temp}/ci-performance-npm`. Its resolved path remains identical across
prime, cold and warm runs: `actions/cache` also binds the cache version to the
path and compression. Separate runners and the experiment key provide isolation.
Before every restore/install, the directory is proven empty; existing contents
are neither deleted nor silently used. `setup-node` enables no npm caching.
The path is resolved in the initialization step using its `runner.temp` context
and passed to restore, measurement and save through `GITHUB_ENV`.

- `cold`: no restore and no save; no fallback to an existing cache.
- `prime`: run the complete baseline once, then save the isolated cache under the
  experiment key. This run does not count toward measurements.
- `warm`: restore only that exact key; `fail-on-cache-miss: true` and
  `cache-hit == true` are required. A cache miss ends as an invalid run and is
  not evaluated as a warm run.

The key contains experiment, OS/architecture, exact Node/Go versions and the
`package-lock.json` hash. Both sources must use the same lockfile.
Only npm package data is shared, no `node_modules`, Next/Vite outputs or Go build
caches. Other project caches are not deleted.

The actual Node target installation deliberately retains only `PATH`, `HOME`
and `TMPDIR`. A benchmark PATH wrapper for the same npm CLI therefore pins
`--cache` at process start and records the cache path even in these sanitized
environments. Neither the application nor installer itself is modified for this.
`HOME` is unchanged. `/proc` verifies cache arguments or cache environment of
observed npm/npx processes. A differing cache path aborts the sample.
Baseline and Node candidate must prove at least one actual target installation
with a sanitized environment.
Root installations use the pinned Node runtime's global npm CLI.
Target installations with a sanitized environment explicitly use the locked
`source/node_modules/npm/bin/npm-cli.js` also supplied by the normal npm test
lifecycle. CLI paths and both actual npm versions are recorded and compared
across variants.

## Start before merging

GitHub requires a workflow on the default branch for `workflow_dispatch`.
This workflow therefore also supports explicitly triggered
`pull_request: labeled` events on PRs in the same repository.
Other labels start no benchmark jobs. The five benchmark labels are:

- `ci-performance-prime`
- `ci-performance-baseline-cold`
- `ci-performance-candidate-cold`
- `ci-performance-baseline-warm`
- `ci-performance-candidate-warm`

Adding a label creates an independent run. Remove the label after it starts so
it can be added again. The experiment key contains the PR number and frozen
PR head SHA. A new candidate revision therefore has its own cache and
measurement series.

First complete `prime` successfully once. Then start five cold pairs and ten
warm pairs; within a pair start baseline/candidate first, then candidate/baseline
in the next pair. Record start order and run IDs. Keep both sources unchanged
throughout the series; also record other CI load and runner image changes.
The workflow starts at most three runners concurrently per sample.
Triggering multiple samples must also be bounded; serial pairs avoid
self-inflicted queue waits.

After merging, the same process can be triggered with `workflow_dispatch` inputs
`variant`, `source-ref`, `cache-state` and `experiment`. `source-ref` must be an
exact 40-character commit SHA. The prime variant is always `baseline`.
Do not trigger the production `Release: Publish and deploy` pipeline for measurements.

## Read-only evaluation

With authenticated `gh` and read access to Actions:

```sh
node scripts/ci-performance.mjs collect ramiz4/riparim .agents/ci-performance-results RUN_ID_1 RUN_ID_2
node scripts/ci-performance.mjs report .agents/ci-performance-results/samples.json .agents/ci-performance-results/report.json
```

`collect` reads workflow/job metadata, downloads only measurement artifacts and
preserves raw REST data alongside unchanged logs and manifests. It publishes
nothing and modifies no labels or runs. Evaluation requires identical
application/catalogue/migrations, runtime versions, runner class, experiment and
cache key, and a consistent source revision per variant. Duplicate run IDs are
rejected. Artifacts are loaded exclusively through
`ci-performance-RUN_ID-RUN_ATTEMPT-*` from the evaluated attempt. Each collection
gets its own attempt directory; older artifacts are not mixed with the current
attempt. Setup/cache errors, incomplete or mixed metadata, cancelled jobs and
retries appear with reasons and raw data paths in `invalid-samples.json` and the
report. They do not stop collection of other runs and do not contribute to
success quantiles. Partial reruns lacking current lane artifacts are invalid
benchmark retries; earlier producers are not presented as new samples for this
measurement.

Success quantiles count only successful first attempts. Failures and retries
are reported separately. At least five successful cold and ten successful warm
samples per variant are required; fewer samples produce an explicitly incomplete
report. Median = middle value or mean of the two middle values;
P95 = nearest rank.

Time metrics refer to the actually executed `Benchmark` jobs:

| Metric               | Definition                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Initial wait         | Run creation to the first verification job start; also includes the short harness plan job.          |
| Active critical path | Maximum active producer runtime plus active runtime of the subsequent candidate gate.                |
| Execution span       | First job start to the last active job completion; includes staggered runner starts.                 |
| Scheduler delay      | Execution span minus active critical path.                                                           |
| Inter-job idle       | Sum of intervals without any active verification job.                                                |
| End-to-end           | Run creation to the last active verification job completion; not `updated_at`.                       |
| Runner seconds       | Sum of all active verification job runtimes, including setup, cache and measurement artifact upload. |

The candidate has the same additional checkout/gate runner as normal CI;
its active time, runner seconds and intervening wait count too.
The overall matrix result succeeds only if every lane succeeded; the gate job
checks this with the normal `verify-ci-gate.mjs`.
Planning and evaluation are harness overhead. Measurement artifact uploads
are included in job times. Individual commands and suites appear in
`phases.jsonl`; `subphases` incorporates `[ci-phase]` JSON from the renderer and
Node integration suites. Baseline sources without subphase instrumentation still
have their full command/suite runtimes. Network, installation, HTTP, rendering
and shutdown may be changed only on the basis of existing phases.
Do not add overlapping phases/suites to critical path time.

On Linux, memory is measured through `/proc` every 100 ms as the **sum of RSS
of the command process tree**, including observed detached/reparented children
identified by PID/start time. This observed peak may miss short spikes and
count shared pages multiple times. It is neither a single process MaxRSS from
GNU time nor an exact container limit. Resource measurement errors invalidate
a sample. On macOS the profiler explicitly reports this measurement unavailable.

Acceptance requires an active-path median at least 35% shorter, an improved
P95 and median runner seconds at most 125% of baseline. Warm-cache operating
budget: P50 ≤240 s, P95 ≤300 s. The actual release path with Cloudflare deployment
has an additional P50 ≤360 s target excluding initial queue/approval waits;
this read-only benchmark does not deploy and can verify that target only through
later actual release observations. Explicitly record target deviations and
follow-up actions before closing the issue. Even 30 controlled successful runs
do not establish a general flake guarantee.

## Workflow and run names

Workflow display names follow `Category: Purpose`: a short, unique English name
using ASCII characters. The category prefix identifies related work in the
Actions list; the purpose names its task. Filenames remain stable technical
identities for API calls, monitoring and reusable workflows.

| File                           | Display name                  |
| ------------------------------ | ----------------------------- |
| `ci.yml`                       | `CI: Verify and build`        |
| `conventional-pr.yml`          | `CI: Check PR title`          |
| `release.yml`                  | `Release: Publish and deploy` |
| `auth-backup.yml`              | `Backup: Supabase Auth`       |
| `platform-backup.yml`          | `Backup: Platform`            |
| `ci-performance-benchmark.yml` | `Benchmark: CI performance`   |

`run-name` adds context for an individual run: CI and title checks show PR
number and title; backups show branch and `scheduled` or `manual`; benchmarks
show variant/cache state or triggering label and PR number or experiment.
Release keeps GitHub's default event name, the commit subject, so the underlying
change remains visible in the run list.

Job names with external contracts are preserved exactly:
`Tests, types, lint and build`, `Conventional PR title` and the main caller
`Verify merged main`. This also preserves the Node installer's checked name
`Verify merged main / Tests, types, lint and build`. Stored monitor labels
`Supabase Auth Backup` and `Platform Backup` remain stable logical identities;
backup workflows are read through their file paths. Changing the display name
requires no monitor state migration.

`tests/ci-workflow.test.mjs` checks all six names, their uniqueness, contextual
run names, existing triggers and external check names. The naming convention
is a repository decision; GitHub supplies separate
[`name` and `run-name`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#name)
fields and supports `github` and `inputs` contexts in run names.

## Primary sources

The quality branch semantically validates all `.github/workflows/*.yml` using
official actionlint **1.7.12**, pinned by SHA-256. This checks expression contexts
and job/step contracts, among other things. `-shellcheck= -pyflakes=` disables
only optional additional Shell/Python integrations; workflow verification stays
fully active and needs no additional app dependency.
The candidate benchmark invokes the same `scripts/check-workflows.sh` entry
point after installation and fully counts download and verification as the
`workflow-lint` phase. The baseline revision does not yet have this additional
check; its original verification set is preserved in the comparison.
The candidate expands the verification contract without changing application inputs.

- [GitHub: workflow events and dispatch prerequisites](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub: workflow job metadata and attempt API](https://docs.github.com/en/rest/actions/workflow-jobs)
- [actions/cache: exact restore and separate save](https://github.com/actions/cache)
- [actions/cache: cache version and path binding](https://github.com/actions/cache#cache-version)
- [actions/setup-node: package cache options](https://github.com/actions/setup-node)
- [actionlint: pinned version and semantic workflow verification](https://github.com/rhysd/actionlint/blob/v1.7.12/docs/usage.md)

## Result on October 14, 2026

Measured candidate `a60aaa387fbe058cc537dd884ecb84b34614c821`, baseline
`1648f6b8bc780fce820fd1d937774cf3231248e1`. All 423 application inputs, catalogue,
migrations and lockfile match. Ubuntu 24.04, four CPUs, 16 GiB class,
Node 24.21.0, Go 1.27.1, npm 11.19.0 and target npm 11.21.0.

| Package cache | Successful pairs | Active path P50 before → after | P95 before → after | P50 runner seconds before → after | Reduction |
| ------------- | ---------------: | -----------------------------: | -----------------: | --------------------------------: | --------: |
| Cold          |                5 |                    475 → 212 s |        484 → 226 s |                       475 → 520 s |     55.4% |
| Warm          |               10 |                  423.5 → 217 s |        474 → 233 s |                   423.5 → 493.5 s |     48.8% |

All 30 evaluated first attempts passed; no failures, invalid samples or retries.
Prime is excluded. Every warm lane hit the exact cache; cold runs restored no
cache. Actual Next starts: baseline three, candidate one. Overall verification
and all runner costs are included. Runner time rises by 9.5% cold or 16.5% warm,
remaining below 25%. Warm P50/P95 remain below 240/300 seconds.
All measurement targets are therefore met.

During the measurement series, the user explicitly requested completion.
No additional attempts were started; the already authorized final runs completed
during final verification. The complete original sample is therefore available.
Small samples still establish no general flake guarantee.

Prime and the first cold pair started simultaneously; later samples ran in
bounded groups. Additional runner load and waits are documented.
Images changed between `20261004.327.1` and `20261012.334.1`; CPU models vary.
This compares the same documented runner class, not byte-identical VM images.
Raw capacities and versions remain in the dataset. Hooks and RSS observers run
in both variants; the candidate also contains new regression tests and the
workflow check.

Run links, digests, capacities, complete runtimes and the reproducible report
are in [ci-performance-results.json](ci-performance-results.json).
Actions measurement artifacts contain original logs and phases. The rejected
workflow-definition run [38549303157](https://github.com/ramiz4/riparim/actions/runs/38549303157)
precedes the valid measurement series and explicitly does not count as a sample.
The later capacity/metadata correction is offline validation and changes no
measured programs or times. The actual release path was not deployed for the
benchmark; there is not yet a sufficient sample for its new production P50.
