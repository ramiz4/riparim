# Release waits after Issues 90–92

Measurement date: 2026-10-11, baseline `85c33b0a4449646517b4c643501f482ba68f62b2`.
All times come from GitHub Actions run/job timestamps; dates and logs are UTC.
Job runtimes include setup and cleanup. Wait time before job start includes
possible runner and concurrency waits; GitHub provides no reliable breakdown
by these causes here.

## Historical runs and retries

| Run / attempt                                                                                           | Wait before verification job | Active verification job | Subsequent steps                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------------: | ----------------------: | ---------------------------------------------- |
| [Release 37365785961, attempt 1](https://github.com/ramiz4/riparim/actions/runs/37365785961/attempts/1) |                        320 s |                   147 s | Release 37 s; deployment cancelled after 902 s |
| [Same release, attempt 2](https://github.com/ramiz4/riparim/actions/runs/37365785961/attempts/2)        |                        241 s |                   285 s | Release 32 s; deployment skipped               |
| [PR CI 37364195930](https://github.com/ramiz4/riparim/actions/runs/37364195930)                         |                        308 s |                   304 s | No production job                              |
| [Title check 37365493954](https://github.com/ramiz4/riparim/actions/runs/37365493954)                   |                        329 s |                    31 s | No production job                              |

Attempt 1 was created on October 5 at 19:48:37. Attempt 2 started only at
21:57:23; its verification job ran 22:01:24–22:06:09. The difference between
original creation and completion includes the pause before retry and is not
build time. Comparable waits in PR CI and title checking, which are outside
production concurrency, prevent attributing the entire delay to release
serialization. Runner availability is a possible cause, but these data do not
conclusively confirm it.

The first semantic job published `v1.7.0` for commit
`45a8a358dc97f50f1cd0489cbeb5e44a081cf778` at 19:57:35. Attempt 2 reported
`A newer main commit exists; its queued workflow will create the release.`
This retry was already tagged. Its 285 s of verification therefore do not prove
safely avoidable work for an unpublished old commit.

## Current main runs

| Main run                                                                                        | Creation to verification job start | Active verification job | Verification end to release start | Release end to deployment start |
| ----------------------------------------------------------------------------------------------- | ---------------------------------: | ----------------------: | --------------------------------: | ------------------------------: |
| [352be3a, before Issue 90](https://github.com/ramiz4/riparim/actions/runs/38094220885)          |                                2 s |                   444 s |                               2 s |        Deployment skipped: docs |
| [b88b2df, after Issue 90](https://github.com/ramiz4/riparim/actions/runs/38094733816)           |                                3 s |                   242 s |                               2 s |                             4 s |
| [2b857d0, further catalogue change](https://github.com/ramiz4/riparim/actions/runs/38095275181) |                                2 s |                   242 s |                               2 s |                             3 s |
| [93a6937, after Issue 91](https://github.com/ramiz4/riparim/actions/runs/38096765160)           |                                2 s |                   203 s |                               2 s |                             4 s |
| [85c33b0, after Issue 92](https://github.com/ramiz4/riparim/actions/runs/38097639289)           |                                2 s |                   188 s |                               3 s |                             3 s |

These different commits show actual overall process runtimes; they do not
replace a controlled comparison of individual changes. Controlled test
measurements are in [test-suite-concurrency.md](test-suite-concurrency.md),
tool installations in [ci-tool-installs.md](ci-tool-installs.md).

## Decision and smallest correction

The remaining multi-minute queue bottleneck is not reproducible in current runs.
No savings through parallel release verification or an early skip job are
proven; no such restructuring is therefore performed. `production-release`
remains serialized across verification, publication and deployment with
`cancel-in-progress: false`. PR required checks and both builds run completely.
No paid runners or new resources are used.

The investigation instead confirms a retry error: the release CLI previously
checked newer main before the already published tag, thereby suppressing its
deployment on a full retry. The smallest correction first revalidates and reuses
the published tag for the exact verified commit. Only for an untagged commit
is remote main checked immediately before a new semantic publication.
Errors, empty responses and invalid SHA/ref responses abort this path.

No additional time savings are claimed for Issue 93. The correction restores
documented retryability. Existing provenance checking of both archives before
the decision and deployment blocking against a newer fully published release
remain. Incomplete publications remain errors and receive no new tag.

`release-retry.test.mjs` runs the actual release CLI with a temporary local Git
remote and isolated archive/provenance fixtures; SDK and GitHub responses are
replaced without publication. It checks docs/chore retries, nearby main changes,
superseded untagged commits, damaged provenance, multiple tags, incomplete
publications and failed/invalid remote queries. Existing deployment tests also
check unchanged archive bytes, newer docs main and newer complete releases before
production operations. No actual production retry is triggered for this analysis.
