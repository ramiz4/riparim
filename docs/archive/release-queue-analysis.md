# Release waits: October 11, 2026

Issues #90–93 distinguished Actions queue/concurrency waits from active job time.
The [original run](https://github.com/ramiz4/riparim/actions/runs/37365785961/attempts/1)
waited 320 s before 147 s verification; its later retry waited 241 s before 285 s
verification. PR/title jobs also waited minutes outside production concurrency.
Runner shortage and serialization alone were therefore not proven causes.

Later runs did not reproduce multi-minute waits. Different commits were not a
controlled attribution study; no early-skip/parallel-release or Issue #93 time
saving was claimed. Production publication stayed serialized without cancellation,
with full PR checks/builds and existing unpaid resources.

The retry fix revalidated/reused an already published exact-commit tag before
checking newer main. Untagged commits still checked remote main before publication;
invalid queries/provenance and newer completed releases still blocked unsafe work.
[Retry regressions](../../tests/release-retry.test.mjs) used local fixtures.
No live retry was triggered. Supporting measurements: [concurrency](test-suite-concurrency.md)
and [tool installs](ci-tool-installs.md). Current procedure: [releases](../operations/releases.md).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/release-queue-analysis.md).
