# Worker shutdown: October 10, 2026

Issue #90 found unread status/header-only response bodies delaying
`Miniflare.dispose()`, rather than a timer after disposal. On the same production
build assertions, disposal took 102.795 s (Cloudflare) and 95.080 s (Sites).
Consuming real bodies reduced cleanup/disposal to 0.089 s and 0.033 s, removing
about 198 s across targets. A separate unread two-MiB asset reproduced the delay.

[The runtime helper](../../tests/helpers/worker-runtime.mjs) consumes outstanding
bodies on success/failure and disposes even when reading fails. Concurrent branches
settle before rethrowing; assertion, body and disposal errors are retained together.
Provider isolation and assertions stayed intact, with natural process exit.
[Regressions](../../tests/worker-runtime.test.mjs) covered streamed/error bodies,
early failures, delayed siblings, cleanup errors and exit within five seconds.

These were local Node/Miniflare measurements with locked dependencies, not live
production behavior or Actions queue savings. Actual job/step durations require
separate comparison. Current build/test procedure: [testing](../development/testing.md).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/worker-test-shutdown.md).
