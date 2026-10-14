# Worker shutdown — 2026-10-10

Historical Issue #90 instrumentation: Node 24.19.0, fresh locked dependencies,
Miniflare 4.20260515.0, portable Linux profile. Baseline
`2d593346c2337f827801835787bd4f4424da5ccc`; both targets used existing assertions
against production builds.

| Target     | Assertions | Baseline dispose | Exit after dispose | Fixed cleanup+dispose |
| ---------- | ---------: | ---------------: | -----------------: | --------------------: |
| Cloudflare |   10.808 s |        102.795 s |            0.003 s |               0.089 s |
| Sites      |   10.380 s |         95.080 s |            0.004 s |               0.033 s |

Unread status/header-only response bodies (including streamed assets on Node
loopback) delayed `Miniflare.dispose()`, not a timer after disposal. Consuming them
removed about 198 s across targets; stopping workerd alone did not release streams.
A separate two-MiB unread asset reproduced 105.068 s disposal.

`tests/helpers/worker-runtime.mjs` consumes outstanding real bodies on success and
failure, then disposes even if reading fails. Concurrent branches settle before
rethrowing; assertion/body/disposal errors are retained together. Assertions/provider
isolation stay intact and process exit stays natural.
`tests/worker-runtime.test.mjs` covers 404/API/streamed binary bodies, natural exit
within five seconds, failed assertions/delayed siblings and injected cleanup errors.
Red evidence: unconsumed bodies, early-failure timeout and masked assertion; fixes pass.

```sh
BUILD_TARGET=cloudflare npm run build
npm run release:package
node -e 'require("node:fs").rmSync("dist", { recursive: true, force: true })'
BUILD_TARGET=sites npm run build
node scripts/package-release.mjs sites
node tests/worker-runtime.test.mjs
```

For baseline instrumentation, measure `performance.now()` around disposal and in
`process.on('exit', ...)`; helper reports fixed cleanup. Compare actual Actions
step/job durations separately from queues. Local measurements alone do not prove
resulting production behavior. See [testing](../development/testing.md).
