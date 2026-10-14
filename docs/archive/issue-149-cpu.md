# Private-page CPU evidence: October 12, 2026

Issue #149 optimized production without a 10 ms guarantee. The plan and existing
500 ms CPU limit stayed unchanged; success under it did not prove Free suitability.
Live v1.21.4 warm guest private pages had medians of 17–34 ms; catalogue RSC
was 140 ms and about 342 KB. First observations did not establish cold isolates.

Isolated workerd removed catalogue serialization from private interfaces and
shared authorized reads/provider validation within each request. Revocation,
blocks and roles remained checked on every request. Local authenticated API
warm medians became 2.65–4.20 ms; cold medians were 9.60–13.89 ms, so some
authenticated paths still exceeded 10 ms. Catalogue RSC shrank to 19,620 bytes.

[The profiler](../../scripts/profile-worker-cpu.mjs) recorded fixtures and raw samples;
it blocked providers, excluded module initialization and was not billing.
Three fresh isolates, 30 warm calls and small populated responses did not prove
large-inventory performance or combined navigation totals. Production after-release
remeasurement remained required. Local locale/theme/keyboard regressions passed.

Older cron events ceased before this task's release; this task did not prove the
cause. After-release observation remained outstanding. No mail was sent.

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/issue-149-cpu.md).
