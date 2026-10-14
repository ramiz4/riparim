# Catalogue history: October 2026

Historical evidence through October 14; these counts and provider/setup states
are not a live inventory. Current procedure: [workshop data](../data/workshops.md)
and [daily import](../data/daily-import.md). JSON manifests retain per-business
sources, verification times, revisions and unresolved cases.

## Identity reviews and removals

| Date/stage              | Result at that stage                                                                                                                                                               | Authoritative evidence                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| October 4               | Nine approvals; 78 public/85 drafts, 19 precise coordinates. Autodiagnoza/BMW Ferizaj deferred for >300 m location conflicts.                                                      | [Review](../../data/catalogue-review-2026-10-04.json)                                                           |
| October 5, first review | 32 new IDs plus two clarified locations: 112 public/51 drafts, 21 precise coordinates. Shared server limit reached 100, without bypass.                                            | [Review](../../data/catalogue-review-2026-10-05.json)                                                           |
| Follow-up               | 13 approvals: 125 public/38 drafts, 23 precise coordinates. Kimi/Gazi use distinctive identity plus profile-specific independent markers within 300 m despite absent Google phone. | [Follow-up](../../data/catalogue-followup-2026-10-05.json)                                                      |
| Remaining identities    | Sfishta Auto Home, Niki, Fatosi confirmed: 128 public/35 drafts; 27 identities unresolved. Continuity evidence does not claim a legal merger.                                      | [Identity report](../../data/catalogue-identity-2026-10-05.json)                                                |
| User-requested removals | 27 unresolved IDs removed: 136 total, 128 public/8 drafts. Migration `0013` prevents old seeders from restoring IDs/metadata.                                                      | [Removal manifest](../../data/workshop-removals.json)                                                           |
| Final review            | Eight drafts removed; one northern Reno profile added: 129 public/no drafts. Burak's truck/bus/motorcycle evidence did not establish required passenger-car scope.                 | [Final review](../../data/catalogue-final-2026-10-05.json), [removals](../../data/workshop-final-removals.json) |

Names, IDs, sources, ownership and Riparim ratings were retained during approval.
Later direct ID checks used a deliberately mismatched fallback search; nearby
BMW balia entries could not establish Axha/Firi/G & B identities. The northern
Reno business received a new ID without southern-profile customer links.
Atomic removals required unchanged drafts without linked visits/ownership/claims/
changes; conflicts blocked the whole operation. Backups and isolated recovery
preceded live writes. Restoration was not authorized by a code rollback.

Precise coordinates came from independent business Plus Codes/directions, decoded
offline, not Google exports/map centres. Search town origins remain distinct:
GeoNames [Skenderaj 785642](https://sws.geonames.org/785642/about.rdf) and
[Obiliq 787534](https://sws.geonames.org/787534/about.rdf), CC BY 4.0.
The approximately 1,700-workshop estimate was user-supplied, not a census.

## Catalogue expansion

| Date       | Source inventory change and scope                                                                                                                                                                            | Evidence                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| October 10 | 129 → 158; 29 businesses, including ten detailers. Historical SDK research used 45 text searches/29 direct ID checks, no server queries or copied business fields.                                           | [Manifest](../../data/import-2026-10-10.json)                                                        |
| October 11 | 158 → 160; Enzo/Shine approved from 17 candidates, six duplicates excluded. Independent own-post mirrors disclosed; identity finder/direct checks were historical procedure.                                 | [Research](research-daily-import-2026-10-10.md), [manifest](../../data/import-2026-10-11-daily.json) |
| October 12 | 160 → 162; AGRONI/JONI. Public Maps UI only; BEXHI lacked Maps phone, BELTI had phone conflict.                                                                                                              | [Manifest](../../data/import-2026-10-12-daily.json)                                                  |
| October 13 | 162 → 164; BERATI/OPEL in Malishevë. An explicitly authorized additional Vushtrri run added eight: 164 → 172. ARDI location reconciled through own directions; Daja's exact street remained unsubstantiated. | [Manifest](../../data/import-2026-10-13-daily.json)                                                  |
| October 14 | 172 → 177; five businesses in Istog/Klinë/Rahovec, four substantiated emails. Source preparation alone did not prove deployment; new unknown-hours records received no schedule.                             | [Manifest](../../data/import-2026-10-14-daily.json)                                                  |

Since October 12, daily research must use public Maps UI only, no owned keys/API/
SDK/finder and no added costs. Research/publication never proves Google ownership.
All additions preserved existing profiles and reviewed SQ/EN translation hashes.
Consult each dated manifest for exact PR/release/live completion state.

## First automation acceptance

The requested 09:00 Europe/Berlin schedule was stored as local time on a
Europe/Zurich desktop, then equivalent; timezone changes require rechecking.
“ACTIVE” and working connections were time-limited setup observations.
[PR #99](https://github.com/ramiz4/riparim/pull/99),
[v1.12.0](https://github.com/ramiz4/riparim/releases/tag/v1.12.0)
(`54549c17df92aecde2d5a7562a7106913e5a8bf0`) and
[run 38093081018](https://github.com/ramiz4/riparim/actions/runs/38093081018)
passed with four then-required artifacts. Two full DE/SQ/EN health runs passed.
All 19 public fields of 158 prior profiles, 158 assignments, 129 stored rating
rows and 49 prior catalogue states matched the protected backup. Outcomes were
`ok` during acceptance; denied detailed billing/log access limited observation.
This does not establish future availability or complete billing evidence.

## Contact and hours research

October 13 contact import preserved ten prior identifiers/addresses/evidence.
October 14 email research for the 172-profile inventory found 113 addresses across
103 businesses, nine with multiple; 69 lists remained empty. Arlindi/Bajrami
assignments remained unsafe. Directory/registry mailboxes can be representatives,
not owners; ARBK Open is an independent directory. Sources and unsuccessful
checks remain in [email evidence](../../data/workshop-emails.json).

The specifically authorized October 13 [hours import](../../data/opening-hours-import.json)
contained 171 schedules: 146 researched, 25 assumed defaults (Mon–Fri 08:00–18:00,
Sat 08:00–16:00, Sun closed), including four conflicting/outdated replacements.
TITANS had no imported schedule due to reported closure; approval status stayed
unchanged. This one-off authorization did not allow general Google bulk import
or ongoing synchronization. Owner removals and confirmed schedules take precedence.
