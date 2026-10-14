# Production cutover — October 5, 2026

Historical acceptance for [#19](https://github.com/ramiz4/riparim/issues/19).
All times: **Europe/Belgrade, UTC+02:00**. The operator agent owned execution/Go-No-Go;
the user authorized exact apex/www DNS replacements and zone-scoped routing access.

## Window and inventory

| Event                               | Time/result                                                     |
| ----------------------------------- | --------------------------------------------------------------- |
| First announced attempt             | 00:50–01:05; No-Go for DNS conflicts/pending authorization      |
| Source resumed unchanged            | 01:03:38; no DNS changes or data delta                          |
| Second announced window             | 04:45–05:00                                                     |
| Source frozen / target sole writer  | 04:46:21 / 04:57:35                                             |
| Technical operator acceptance       | Go at 07:16:24                                                  |
| User ended separate fallback period | 09:51:01; [retirement followed](sites-retirement-2026-10-05.md) |

Fresh source/target backups reconciled 19 tables/386 rows against #18:
**0 inserts, 0 updates, 0 deletes**, with 48 verified metadata entries preserved.
Only proven expired Auth counters were projected using a fixed private witness;
no active limits were deleted/restored and no IP identity was inferred.
Source remained read-only; target D1/R2 became authoritative after resumption.

Protected evidence:

- Delta report: `8aaaf863-ab64-462e-b49c-341815beedd1`.
- Source: `domain-source-e3eeddf6-86e7-434e-9eaf-0cd972a976eb`.
- Before/after target: `domain-target-527a4b08-41f2-4272-93b0-03ef1b2be587` /
  `domain-target-complete-90fbf0c5-d896-4be1-8c7d-2a975fdf1c6e`.
- Final target fingerprint: `5ae859d9af4a45ed83fe3a6e6123d7848b9742a6a0a8fc32926a16df58ac9922`.
- Expiry receipt SHA-256: `1fcf2a2537f45b7d68a4c821bca26a59c2ae44fb2f4f694568e3db5dd190ebb4`.

## Domain and releases

Owned zone `cb2470c7a7d49b8a3e6aa3e697c3355e` used `bailey.ns.cloudflare.com`/`ignacio.ns.cloudflare.com`.
Three authorized web records changed; eight email/verification records survived.
Worker `riparim`, D1 `riparim-production`, private R2 `riparim-evidence-production`;
apex/www HTTPS and preserved path/query redirects passed. Existing Supabase/Google
identity/configuration and protected runtime values remained unchanged.

| Release                 | Commit                                     | Verified run                                                              |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| v1.2.6 preparation      | `130d5d4db6f0cfe6d874f1112bd362200973f6b6` | [37239579311](https://github.com/ramiz4/riparim/actions/runs/37239579311) |
| v1.2.7 routing          | `2934a3fb70d4ca384aa9f75e0773a8a8be9e6597` | [37257149551](https://github.com/ramiz4/riparim/actions/runs/37257149551) |
| v1.2.8 callback privacy | `527d37d83c4d88dcb4100556941ce0207dc25763` | [37259289616](https://github.com/ramiz4/riparim/actions/runs/37259289616) |
| v1.2.9 ownership file   | `53ae6ce7a896e779b75e5f249d25b7993c8c12d4` | [37260211387](https://github.com/ramiz4/riparim/actions/runs/37260211387) |

Archive SHA-256 values, in the same order:
`91a5388e883f4a5cd30727c038f7605836d73b675efc9fdd0ec9ddcb0eb3fc7c`,
`96002104ce24969b5db063fff70b4a1b062cfe7c82be2abd996d3454b92afc21`,
`cfe56aa950b331b07107ebd0f6e46aca4929c9a1086abe8da9d0b01e874087e9`,
`f3bd2b57c03e7f42c192bbdde92f4d0ebb17b6ee3a7984bfd30b83a2093a1353`.

## Actual checks and limits

Google login/return/admin/logout, search (18 matches), keyboard navigation,
mobile 390×844 dark and desktop 1280×900 light passed. PRs #38/#39 fixed callback
`no-referrer` and direct HTTP 200 Google verification; automatic later releases
proved publication to the same domain. v1.2.9 deployed at 05:41:24, deployment
`961b802f-0987-47aa-99e8-af5165a6ba67`, version `c4d865d2-3702-402f-993c-54c568083ecb`.
Five preflights and 15 Auth/private-file checks passed from 05:42:31; three marked
accounts/PNG/visit were completely removed. Zero leftover test accounts/errors;
163 workshops, 78 approved remained. Journal: `3cce58df-259a-4461-9d0f-79a0e298feac`.
No actual emails were sent or real reviews moderated; legacy links were zero.

Observation 04:57:35–07:16:24 (2h18m49s): 584 fetch/27 scheduled invocations,
no Worker errors or HTTP 5xx. Automated nonexistent-path 404s were distinguished
from business checks. This proves only the observed interval; the historic app cron
was later removed. Technical acceptance did not authorize final resource deletion.
Reverse transfer into used Sites was unimplemented/untested; preserve newer data
and prefer verified forward fixes. [Current cutover procedure](../operations/domain-cutover.md).
