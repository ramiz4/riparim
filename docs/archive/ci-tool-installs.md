# Tool installation benchmark — 2026-10-11

Historical Issue #92 measurements; [CI](../development/ci.md#locked-tool-jobs)
describes current setup. [Actions evidence](https://github.com/ramiz4/riparim/actions/runs/38097121619/job/114345209368):
one Ubuntu runner, Node 24.21.0, four CPUs, 16,766,414,848 bytes RAM;
all fixtures used merge `f82fac09f00a0cb56043d59b4440188e5eabf285` (PR head `d3811ae`).
Profiles installed serially with separate empty caches, then repeated warm.

| Install  |    Cold |    Warm | npm package count |
| -------- | ------: | ------: | ----------------: |
| Full app | 18.91 s | 14.29 s |             1,037 |
| Title    |  2.03 s |  1.68 s |                76 |
| Release  |  2.90 s |  2.09 s |               302 |
| Deploy   |  2.73 s |  2.17 s |                39 |

All twelve offline smoke completions passed: three tool checks in each full-app
state plus each isolated tool profile in both states. Root pins/release plugins matched.
Title saved 16.88 s cold/12.61 s warm; release+deploy saved 32.19 s/24.32 s.
These are installation times, excluding queues/setup/artifacts/publication.
The actual [title job](https://github.com/ramiz4/riparim/actions/runs/38097121600/job/114345209248)
took 10 s, with a 3 s installation step. Temporary benchmark workflow was removed.

Cloud-host cold/warm smoke checks also passed (1,041 app/42 deploy packages).
Concurrent cold times—title 17.89 s, release 23.79 s, deploy 21.43 s—show
reproducibility, not comparable speed. Optional platform packages affect counts.
Production permissions/secrets, serial release concurrency, exact checkout,
release assets/hashes/provenance, retry and catalogue-import/upload order were preserved.
