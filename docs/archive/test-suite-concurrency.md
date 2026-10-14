# Test concurrency — 2026-10-11

Historical Issue #91 comparison; [testing](../development/testing.md) describes
current runner use. [Run 38096027955/job 114341991218](https://github.com/ramiz4/riparim/actions/runs/38096027955/job/114341991218)
compared all 75 suites+i18n gate in one checkout on one Ubuntu runner:
Node 24.21.0, four CPUs, 16,766,414,848 bytes RAM. Merge
`4e7be6ccf67d07fc09938ca0d33ae52b862a46e8`, PR head `dd046d0`.

| Concurrency | Order  | Runtime | GNU time RSS (KiB) |
| ----------- | ------ | ------: | -----------------: |
| 1           | First  | 77.67 s |            602,380 |
| 2           | Second | 45.17 s |            602,084 |
| 4           | Third  | 36.93 s |            605,520 |
| 1           | Repeat | 70.88 s |            604,356 |
| 2           | Repeat | 45.09 s |            608,324 |

All five runs passed: 380 successful completion messages, no observed failures/OOM.
Four saved 47.9% against repeated serial, 52.5% against first serial and 18.1%
against repeated pairwise. Four became default. Runtime includes i18n/cleanup,
excluding Actions queues/setup. GNU `%M` is the maximum individual RSS, **not
summed concurrent memory**; these figures prove no total process-tree memory limit.

## Isolation and limits

Suites own subdirectories/unique files under `.test-runtime`; only runner removes
root. SQLite uses memory; import/transfer/release/email/lock fixtures use temporary
directories; Miniflare uses isolated data/free ports. Global DOM/React/mocks are
separate processes; Go shares only its lock-protected build cache. No suite ordering
is required; catalogue/migrations are read-only.

Runner regressions check concurrency/serial/all starts, i18n gate, attributed logs,
failure/signals and stubborn descendants using handshakes, not timing assumptions.
After measurement, native Windows execution was refused and its contract tested
via simulated `win32`, not on native Windows. POSIX scheduling/suite registrations
were preserved and checked in final CI; measurement-only workflow was removed.
