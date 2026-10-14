# Tool installation benchmark: October 11, 2026

Issue #92 measured serial locked installs on one Ubuntu runner with separate
empty caches, then warm repeats. [Actions evidence](https://github.com/ramiz4/riparim/actions/runs/38097121619/job/114345209368)
records the exact source and environment.

| Install  | Cold    | Warm    |
| -------- | ------- | ------- |
| Full app | 18.91 s | 14.29 s |
| PR title | 2.03 s  | 1.68 s  |
| Release  | 2.90 s  | 2.09 s  |
| Deploy   | 2.73 s  | 2.17 s  |

All twelve offline smoke completions passed with matching root pins and release
plugins. The actual title job took 10 s, including a 3 s install step.
Cloud-host smoke checks also passed, but their concurrent times were not comparable.
These results exclude queue/setup/publication time and prove no deployment speedup.
Permissions, provenance and serialized release behavior were preserved.
The temporary benchmark workflow was removed. Current setup: [locked tool jobs](../development/ci.md#locked-tool-jobs).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/ci-tool-installs.md).
