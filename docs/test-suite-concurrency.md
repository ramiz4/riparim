# Bounded test concurrency (Issue 91)

`npm test` first checks the i18n contract, builds Node once under the same process
group management, then runs each registered suite in its own Node process.
Both Node integration suites use validated copies of this build in separate
fixtures.

`npm test -- --group core` runs all other suites without a Node build;
`npm test -- --group node` checks the two Node integration suites.
Explicit `RIPARIM_NODE_PREBUILT` must match current source/output digests.
Central registration enforces complete disjoint groups; the default without a
group remains complete verification. Process and controlled measurements are
in [ci-performance.md](ci-performance.md). Default concurrency on Linux/macOS/WSL
is four. `TEST_CONCURRENCY=1 npm test` runs the same suites serially;
`2`, `3` or `4` permit that many concurrent suites.
Native Windows execution is rejected with a WSL recommendation before any suite
or test directory change. POSIX process groups ensure cleanup even when a
terminated Node process leaves descendants with open output channels.
`taskkill` cannot reliably cover this after the parent process ends;
there is therefore no native Windows test path.

## Verified resources

- Each suite writes only to its own subdirectories or uniquely named files
  under `.test-runtime`; only the runner removes its root.
  `repository-policy.test.mjs` removes only its own subdirectory.
- SQLite fixtures use `:memory:`. Import, data transfer, release, email export
  and lock fixtures use their own `mkdtemp` directories.
  Static catalogue data, migrations and sources are only read.
- Miniflare fixtures choose free local ports and isolated runtime data.
  There is no shared test database or fixed suite port.
- Global DOM, provider mocks and React state are isolated per Node process.
  Actual Go email renders share only Go's lock-protected build cache.
  No suite needs the result of a preceding suite.

## Errors, signals and diagnostics

Every output line and start/end message carries the suite filename.
A failed suite stops the queue and running siblings. SIGINT and SIGTERM return
130 and 143 respectively. Linux/macOS suites have their own process groups:
SIGTERM also reaches Node, Go, esbuild and workerd descendants; still-running
groups receive SIGKILL after 500 ms. The success path does not wait 500 ms if
the group has already disappeared. Remaining descendants of a successfully
terminated Node process are also cleaned up. `.test-runtime` is removed only
after process termination and output channel closure.

Runner regression checks concurrency bounds, serial mode, all suite starts,
the i18n gate, attributed logs, failures, both signals and descendants ignoring
SIGTERM. It uses dedicated temporary directories and a handshake instead of
timing assumptions to verify concurrent starts. An isolated child also simulates
`process.platform = 'win32'` and checks immediate failure, absence of suite starts
and unchanged test directory. This platform contract check is no native Windows test.

## Measurement

[Actions run 38096027955, job 114341991218](https://github.com/ramiz4/riparim/actions/runs/38096027955/job/114341991218)
compared all 75 suites, including the i18n gate, on October 11, 2026 in the same
checkout and on the same Ubuntu runner: Node.js 24.21.0, four CPUs,
16,766,414,848 bytes RAM. Measured merge commit:
`4e7be6ccf67d07fc09938ca0d33ae52b862a46e8`, PR head `dd046d0`.

| Concurrency | Order      | Test runtime | GNU time RSS (KiB) |
| ----------- | ---------- | -----------: | -----------------: |
| 1           | First run  |      77.67 s |            602,380 |
| 2           | Second run |      45.17 s |            602,084 |
| 4           | Third run  |      36.93 s |            605,520 |
| 1           | Repeat     |      70.88 s |            604,356 |
| 2           | Repeat     |      45.09 s |            608,324 |

All five complete runs passed: 380 successful process completion messages
(75 suites plus i18n gate per run), no failures or observed OOM aborts.
Four processes save **47.9%** test time against the repeated serial run,
**52.5%** against the first serial run and **18.1%** against the repeated
pairwise execution. Four is therefore the default.

Runtime includes i18n checking and cleanup, excluding Actions queue and setup.
GNU time `%M` is the maximum individual RSS from process/child rusage,
**not a summed peak of the concurrently running process tree**.
The figures prove no corresponding total memory limit.

After measurement, the unsafe native Windows path was removed and the fail-fast
contract check added. The POSIX scheduler and all existing suite registrations
are preserved; final Linux state is checked with default concurrency four and
complete CI. The additional measurement-only workflow is removed.
The final runner log line also reports concurrency, exit code and total test
runtime locally.
