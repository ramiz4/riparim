# Release waits — 2026-10-11

Historical Issues #90–93 analysis, baseline
`85c33b0a4449646517b4c643501f482ba68f62b2`. UTC Actions run/job timestamps;
active jobs include setup/cleanup, waits combine runner/concurrency causes without
reliable separation. [Current releases](../operations/releases.md).

| Run                                                                                    |  Wait | Verification | Later steps                                |
| -------------------------------------------------------------------------------------- | ----: | -----------: | ------------------------------------------ |
| [37365785961/1](https://github.com/ramiz4/riparim/actions/runs/37365785961/attempts/1) | 320 s |        147 s | Release 37 s; deploy cancelled after 902 s |
| [37365785961/2](https://github.com/ramiz4/riparim/actions/runs/37365785961/attempts/2) | 241 s |        285 s | Release 32 s; deploy skipped               |
| [PR 37364195930](https://github.com/ramiz4/riparim/actions/runs/37364195930)           | 308 s |        304 s | No production                              |
| [Title 37365493954](https://github.com/ramiz4/riparim/actions/runs/37365493954)        | 329 s |         31 s | No production                              |

Release created October 5 19:48:37; retry began 21:57:23, verification
22:01:24–22:06:09. Retry pause is not build time. PR/title waits outside production
concurrency prevent blaming serialization alone; runner shortage remains unconfirmed.
First attempt published `v1.7.0` for `45a8a358dc97f50f1cd0489cbeb5e44a081cf778`
at 19:57:35. Retry's newer-main skip applied to an already tagged commit;
its 285 s does not prove avoidable verification of unpublished work.

| Main run                                                              | Initial wait | Verification | To release |     To deploy |
| --------------------------------------------------------------------- | -----------: | -----------: | ---------: | ------------: |
| [352be3a](https://github.com/ramiz4/riparim/actions/runs/38094220885) |          2 s |        444 s |        2 s | Skipped: docs |
| [b88b2df](https://github.com/ramiz4/riparim/actions/runs/38094733816) |          3 s |        242 s |        2 s |           4 s |
| [2b857d0](https://github.com/ramiz4/riparim/actions/runs/38095275181) |          2 s |        242 s |        2 s |           3 s |
| [93a6937](https://github.com/ramiz4/riparim/actions/runs/38096765160) |          2 s |        203 s |        2 s |           4 s |
| [85c33b0](https://github.com/ramiz4/riparim/actions/runs/38097639289) |          2 s |        188 s |        3 s |           3 s |

Different commits show overall runtimes, not controlled attribution. See
[concurrency](test-suite-concurrency.md) and [tool installs](ci-tool-installs.md).
Multi-minute waits were not reproduced; no early-skip/parallel-release savings proved.
`production-release` retained serialization and `cancel-in-progress: false`, complete
PR checks/builds and existing unpaid resources. No Issue #93 time saving is claimed.

Smallest fix: revalidate/reuse an already published exact-commit tag before checking
newer main. Only untagged commits check remote main immediately before semantic
publication; errors/empty/invalid SHA/ref abort. Both archive provenance checks,
newer-complete-release deploy blocking and incomplete-publication errors remain.
`release-retry.test.mjs` uses local Git/provider/archive fixtures to cover retries,
newer commits, damaged provenance, tags/publications and failed queries; deployment
tests preserve archive bytes and supersession checks. No live retry was triggered.
