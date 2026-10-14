# Independent static-release review: October 10–11, 2026

Historical review of baseline `2d593346c2337f827801835787bd4f4424da5ccc` and the
uncommitted `codex/daily-workshop-import` changes. The reviewer changed only this
report. Four findings were corrected by final review; final full CI/build/main
release/live acceptance were still outstanding then. Later publication evidence:
[catalogue history](catalogue-history.md#first-automation-acceptance).

## Findings and verified corrections

| Priority/finding                                     | Reproduction                                                                                                                                    | Correction confirmed by follow-up                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1: One admin change disabled every profile snapshot | Changing one of two live revisions made the untouched profile return `null`, with zero asset fetches. Live recurrence of 1102 was not measured. | Individual publication/revision checks retained the unaffected asset; changed profile/catalogue used data-free shells; hidden profile returned 404. |
| P2: Dynamic profile ignored new review props         | React rerender with an approved review left the empty state (`updatedReviewPresent:false`).                                                     | Dynamic path adopted new props; repeated probe returned `true`.                                                                                     |
| P1: Selective-router fixture used wrong option type  | Native test failed `ERR_VALIDATION`, array supplied to boolean `invoke_user_worker_ahead_of_assets`.                                            | Wrangler-compatible `static_routing.user_worker` mapping plus actual `html_handling` configuration.                                                 |
| P2: Health preflight accepted unavailable shell      | Complete “Profile unavailable” HTML with shell marker yielded `unavailableShellHealthy:true`.                                                   | Required actual `data-workshop-id` plus expected live name; regression passed.                                                                      |

The final independent asset-router probe rejected internal paths with encoded
underscores/slash/double slash in four variants. The implementing agent reported
the prior 158-record full Worker test passed; final 160-record build still needed
its own run. An earlier selective-router probe timed out and was terminated;
it was neither success nor confirmed router failure.

## Import, privacy and source checks

Shared [statement factory](../../db/catalogue-import.ts) served runtime/release
plans. Deployment regenerated and compared the whole reviewed plan before writes,
ran batches of 50 and wrote completion marker last, after migrations/before
upload. This removed the regular first-import Worker CPU step.
[Plan regression](../../tests/catalogue-release-plan.test.mjs) passed independently:
partial abort/resume, no-op repeat, newer admin protection, tampering/commit
mismatch and SQL escaping. Production backup was not reopened by the reviewer.

Renderer used isolated D1/R2 and blocked outbound providers, published IDs only,
with local binding override rather than an HTTP bypass. Private sessions remained
`no-store`/server-authorized; reviews were approved-only. Release archives covered
HTML/manifest hashes. CI retained full canonical validation and live translation
hash checks. No additional concrete privacy/release flaw was found.

Final independent health regression and `catalog:check` passed: 160 published,
160 assigned IDs, no drafts/pending mappings; the Eurogoma shared phone was an
existing branch pair. Enzo/Shine SQ/EN sources and translation hashes were read.
Own posts through AutoYas substantiated contacts/services/location; the additional
Gjithebiznesi request returned 429. Google browser ID checks were not repeated;
no ownership/WhatsApp/unsupported brands/new ratings were claimed.

The [dated manifest](../../data/import-2026-10-11-daily.json) at review time correctly
recorded prepared source, zero confirmed published additions and undeployed
release. Final release provenance/current CI/live CPU and hydrated-page acceptance
belonged to the implementing agent. These isolated probes changed no production
data, providers, automation, browser state or messages.

Primary sources: [asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[bindings](https://developers.cloudflare.com/workers/static-assets/binding/),
[limits](https://developers.cloudflare.com/workers/platform/limits/).
