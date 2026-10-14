# Worker test shutdown (Issue #90)

Instrumented comparison on 2026-10-10, Node 24.19.0, fresh locked dependencies
(Miniflare 4.20260515.0), portable Linux execution profile. Both targets run the
same existing Worker assertions against their production builds. Baseline source:
`2d593346c2337f827801835787bd4f4424da5ccc`.

| Target     | Baseline assertions | Baseline `dispose()` | Baseline process exit after disposal | Fixed response cleanup + disposal |
| ---------- | ------------------: | -------------------: | -----------------------------------: | --------------------------------: |
| Cloudflare |            10.808 s |            102.795 s |                              0.003 s |                           0.089 s |
| Sites      |            10.380 s |             95.080 s |                              0.004 s |                           0.033 s |

The delay is inside `Miniflare.dispose()`, after all assertions, rather than a
Node timer after disposal. Status/header-only checks leave response bodies
unconsumed, including streamed assets. Miniflare serves assets over Node loopback
connections; stopping workerd alone does not promptly release these streams.
Consuming the outstanding bodies before disposal removes about 198 seconds across
the two local build targets. This confirms the unread-response hypothesis.

`tests/helpers/worker-runtime.mjs` retains the real responses, consumes outstanding
bodies on both success and assertion failure, then disposes Miniflare even if a
body read fails. Concurrent locale branches settle before rethrowing their first
failure. Combined assertion/body/disposal errors retain every original error. Existing assertions and provider isolation remain intact. The
success message still marks assertion completion; a separate message records
response cleanup and disposal. Process exit remains natural.

`node tests/worker-runtime.test.mjs` is registered in `npm test`. It exercises
status/header-only 404/API responses and a streamed binary asset with isolated
Miniflare child processes. It checks consumed bodies, a natural exit within five
seconds of assertion completion, and the original failing assertion/nonzero exit
on failure paths, including failure while a delayed asset sibling is unfinished.
Errored Node response bodies and disposal failures are injected at the runtime
boundary to verify error preservation and cleanup. Before response cleanup was
added it failed because bodies remained unconsumed. Early concurrent failure also
reproduced a cleanup timeout; body cleanup failure masked the original assertion.
The fixed fixtures pass all paths. A separate two-MiB asset fixture without body
cleanup reproduced a 105.068-second disposal delay.

Reproduction and comparison commands:

```sh
BUILD_TARGET=cloudflare npm run build
npm run release:package
BUILD_TARGET=sites npm run build
node scripts/package-release.mjs sites
node tests/worker-runtime.test.mjs
```

For baseline instrumentation, record `performance.now()` immediately before and
after the final `await runtime.dispose()`, and in a `process.on('exit', ...)`
listener. The fixed helper reports cleanup duration directly. GitHub Actions
comparison should use step/job execution durations separately from queued time;
confirmation on the resulting PR run is part of the issue handover.
