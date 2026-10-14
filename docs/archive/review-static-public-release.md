# Independent static-release review: October 10–11, 2026

Four reproduced findings were corrected and rechecked:

- A changed profile stopped invalidating every other profile snapshot.
- Dynamic profiles adopted newly approved review props.
- The selective-router fixture used the actual Wrangler option types/configuration.
- Health preflight required the real workshop identity, not an unavailable shell.

Independent import-plan, health, internal-path and catalogue checks passed with
isolated D1/R2 and blocked providers. Published-only rendering, server-authorized
sessions and approved-only reviews preserved privacy. The
[import-plan regression](../../tests/catalogue-release-plan.test.mjs) covered abort/resume,
repeats, newer admin data, tampering and source mismatch. Production backups and
Google browser identity checks were not repeated by this reviewer.

The final 160-record full build, CI, release provenance, live CPU and hydrated-page
acceptance were still outstanding at review; an earlier router probe timed out
without a verdict. The [manifest](../../data/import-2026-10-11-daily.json) correctly
recorded prepared, undeployed source then. Later acceptance:
[catalogue history](catalogue-history.md#first-automation-acceptance).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/review-static-public-release.md).
