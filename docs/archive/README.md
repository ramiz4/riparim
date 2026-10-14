# Historical evidence

These are compact records of past work, not current operating instructions. Their dates, measurements and limitations describe the state observed then. Use the [active guides](../README.md) and current configuration for new work.

## Catalogue and Google

- [Catalogue history](catalogue-history.md): completed imports and source decisions.
- [Daily research, October 10](research-daily-import-2026-10-10.md): candidate and identity evidence.
- [Google cost audit, October 11](google-places-cost-audit-2026-10-11.md): observed requests, costs and enforcement limits.

## Product and performance

- [Customer flow history](customer-flow-history.md): previous QA coverage and release boundaries.
- [UI audit, October 10](ui-performance-audit-2026-10-10.md): asset measurements and pending production measurement.
- [Static public release research](research-static-public-release.md) and [review](review-static-public-release.md): original findings, corrections and limits.
- [Free-tier CPU](free-tier-cpu.md) and [private-page CPU investigation](issue-149-cpu.md): distinct live and local measurements.

## CI

- [CI performance](ci-performance.md): controlled before/after measurements and raw results.
- [Tool installations](ci-tool-installs.md): isolated installation measurements.
- [Test concurrency](test-suite-concurrency.md): resource and runtime evidence.
- [Worker shutdown](worker-test-shutdown.md): response cleanup diagnosis.
- [Release queue](release-queue-analysis.md): observed waits and retry behavior.

## Production transition

- [Data transfer, October 4](data-transfer-2026-10-04.md).
- [Domain cutover, October 5](domain-cutover-2026-10-05.md).
- [Release handover, October 5](release-handover-2026-10-05.md).
- [Sites retirement, October 5](sites-retirement-2026-10-05.md).
- [Schema rollouts](schema-rollouts.md): previous migration and compatibility decisions.

## Original evidence

Machine-readable manifests, audit datasets and source records remain at their existing paths. The summaries link relevant evidence. Protected backups and private account data remain outside Git.

The complete documentation before this reorganization is retained in Git at [`281c130`](https://github.com/ramiz4/riparim/tree/281c130e845758275c0db4655008dbda12fc6c84/docs), including the [original daily research](https://github.com/ramiz4/riparim/blob/281c130e845758275c0db4655008dbda12fc6c84/data/research-daily-import-2026-10-10.md). For exact historical wording, open that snapshot or run `git show 281c130:<original-path>`.
