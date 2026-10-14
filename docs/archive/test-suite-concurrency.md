# Test concurrency: October 11, 2026

Issue #91 compared all 75 suites plus the i18n gate in one checkout on one
Ubuntu runner. [Actions evidence](https://github.com/ramiz4/riparim/actions/runs/38096027955/job/114341991218)
records the source/environment and five serial/pairwise/four-process runs.
All passed without observed failures or OOM.

Four processes reduced runtime from the repeated serial 70.88 s to 36.93 s
(47.9%) and became the default. Runtime included i18n/cleanup and excluded queues/setup.
Recorded GNU time RSS of 602,084–608,324 KiB was the maximum individual process,
**not summed concurrent memory**; it proved no total process-tree memory limit.

Suites retained isolated files, storage, ports and processes; catalogue/migrations
were read-only. Runner regressions checked attributed starts/logs, failure/signals
and stubborn descendant cleanup. Native Windows was refused; its contract was
simulated, not tested on Windows. POSIX scheduling and registrations passed final
CI, and the measurement-only workflow was removed. The small fixed-order sample
establishes the observed comparison, not a general reliability guarantee.
Current runner use: [testing](../development/testing.md).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/test-suite-concurrency.md).
