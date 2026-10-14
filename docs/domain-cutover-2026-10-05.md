# Production cutover on October 5, 2026

This report records the actual cutover from
[#19](https://github.com/ramiz4/riparim/issues/19). Technical operator acceptance
is complete. The separate fallback period for #20 was then explicitly ended
at 09:51:01. [Public retirement](sites-retirement.md) has been performed;
old resources and backups remain preserved under a write lock.

## Responsibility and operating window

The agent assigned in this chat owned execution and the Go/No-Go decision.
The user explicitly authorized replacement of both Sites apex A records and
the www CNAME, and additional CI permission `Workers Routes Write` exclusively
for the owned `riparim.com` zone.

All local times below use Europe/Belgrade (UTC+02:00).

| Event                              | Actual state                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| First announced cutover attempt    | October 5, 00:50–01:05; No-Go because of conflicting DNS records and still-pending explicit replacement authorization |
| Source available again after No-Go | 01:03:38; no domain/DNS changes and no data delta applied                                                             |
| Second announced window            | October 5, 04:45–05:00                                                                                                |
| Source actually frozen             | 04:46:21                                                                                                              |
| New target opened as sole writer   | 04:57:35; public maintenance ended at that point                                                                      |

Preparation and subsequent code corrections happened while the website was
available. Acceptance fixes required no further maintenance pause.

## Final data reconciliation and write access

The protected data transfer from [#18](data-transfer-2026-10-04.md) was not blindly
repeated. New complete backups of the frozen source and target were compared
with the verified transfer baseline. Final reconciliation was a reviewed no-op:
**0 inserts, 0 modifications, 0 deletions**. 19 logical tables and 386 rows were
inventoried on each side. 48 already verified target metadata entries were
preserved. Before synthetic checks, source and target contained no private
R2 objects and no visits.

The preceding technical Auth check had changed only expired `auth_attempts`
rows. A protected before/after receipt with a fixed timestamp proves this
bounded deviation. Reconciliation ignores only independently provable expired
rows for comparison; it restores no old counters and deletes no active limits.
All other tables and columns matched exactly. This receipt does not prove
IP identity.

| Protected evidence                            | Identifier / SHA-256                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Final delta report                            | `8aaaf863-ab64-462e-b49c-341815beedd1`                             |
| Source backup                                 | `domain-source-e3eeddf6-86e7-434e-9eaf-0cd972a976eb`               |
| Target before reconciliation                  | `domain-target-527a4b08-41f2-4272-93b0-03ef1b2be587`               |
| Target after reconciliation                   | `domain-target-complete-90fbf0c5-d896-4be1-8c7d-2a975fdf1c6e`      |
| Complete target fingerprint before resumption | `5ae859d9af4a45ed83fe3a6e6123d7848b9742a6a0a8fc32926a16df58ac9922` |
| Bounded expiry receipt                        | `1fcf2a2537f45b7d68a4c821bca26a59c2ae44fb2f4f694568e3db5dd190ebb4` |

These backups, private configuration and test journals are protected outside
Git. Complete recovery was verified locally. Since resumption, the owned D1/R2
inventory is authoritative; subsequent logins, normal Google metadata and user
writes are no reason to force the old fingerprint again through a restore.

The owned target is on `MIGRATION_READ_ONLY=false`. The old Site remains
permanently on `true`, environment revision 17; its scheduled handler also
skips write work. The old generated URL returns HTTP 503 and `no-store`.
Expiry of protected export access does not reopen source write rights.

## Domain, resources and release evidence

The owned active zone `cb2470c7a7d49b8a3e6aa3e697c3355e` uses
`bailey.ns.cloudflare.com` and `ignacio.ns.cloudflare.com`. Only the three
authorized web DNS records were replaced; eight email and verification records
were preserved. Apex and www are enabled custom domains for Worker `riparim`,
without preview. TLS is active, HTTP redirects to HTTPS, and www preserves
path and query when redirecting to the apex.

| Resource              | Production target                                               |
| --------------------- | --------------------------------------------------------------- |
| Cloudflare account    | `ec181b3a61c7c3da13910600953fc3ea`                              |
| Origin                | `https://riparim.com`                                           |
| D1                    | `riparim-production`, `b395ea3a-5316-4b0b-bdee-533bdb68d6a0`    |
| R2                    | `riparim-evidence-production`, private; no r2.dev / file domain |
| Scheduled handler     | `*/5 * * * *`                                                   |
| Technical Worker host | Same code and target inventory, no second data source           |

The existing Supabase project and its identity namespace are preserved.
Project address, public Auth configuration and enabled state were securely
compared between the source backup and production `auth_settings` row.
Site URL and permitted app callback account for riparim.com; Google provider
callback, client and scopes are preserved. Moderator identity, Supabase
administrative access, both Google keys and Resend values were transferred as
protected runtime values. The deployment token is not a Worker secret.
Actual Google administration and production login confirm the transfer.

| Verified main release        | Commit                                     | Archive SHA-256                                                    | Automatic run                                                             |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| v1.2.6, preparation          | `130d5d4db6f0cfe6d874f1112bd362200973f6b6` | `91a5388e883f4a5cd30727c038f7605836d73b675efc9fdd0ec9ddcb0eb3fc7c` | [37239579311](https://github.com/ramiz4/riparim/actions/runs/37239579311) |
| v1.2.7, permanent routing    | `2934a3fb70d4ca384aa9f75e0773a8a8be9e6597` | `96002104ce24969b5db063fff70b4a1b062cfe7c82be2abd996d3454b92afc21` | [37257149551](https://github.com/ramiz4/riparim/actions/runs/37257149551) |
| v1.2.8, callback privacy     | `527d37d83c4d88dcb4100556941ce0207dc25763` | `cfe56aa950b331b07107ebd0f6e46aca4929c9a1086abe8da9d0b01e874087e9` | [37259289616](https://github.com/ramiz4/riparim/actions/runs/37259289616) |
| v1.2.9, exact ownership file | `53ae6ce7a896e779b75e5f249d25b7993c8c12d4` | `f3bd2b57c03e7f42c192bbdde92f4d0ebb17b6ee3a7984bfd30b83a2093a1353` | [37260211387](https://github.com/ramiz4/riparim/actions/runs/37260211387) |

After controlled domain cutover, v1.2.7 already published automatically on the
same production domain. v1.2.8 proves another automatic publication while the
website was available. Served commit, release provenance and archive hash were
independently verified. The source stayed on Sites version 42, verified
v1.2.0 / `bf0af1913102710925efcadbfa9d3fff7631b694`.

## Actual checks and discovered deviations

- Actual Google login entirely on riparim.com: expected return to
  `/werkstaetten?ort=prishtina`, 18 matching workshops, existing administrative
  access. Subsequent actual logout led to the guest login page.
- Navigation in the published bundle: search, workshop profile by keyboard,
  open photo and Escape, preserved search filter, settings, privacy and browser
  forward/back. No #33 error in the browser log.
- Mobile 390 × 844, dark theme and desktop 1280 × 900, light theme: no horizontal
  overflow; labels and login/navigation visible. The temporary viewport setting
  was reset afterward.
- Administration and moderation view opened read-only with existing Google
  access; no actual review or user administration changed.
- Discovered callback error: the shared proxy overwrote `no-referrer`.
  [PR #38](https://github.com/ramiz4/riparim/pull/38) corrected both paths and
  cookie refresh. Verified in production: signup, recovery and Google error
  callback HTTP 303, `no-referrer`, `no-store`, canonical preserved return target.
- Discovered static redirect: the ownership file received HTTP 307 instead of
  direct HTTP 200. [PR #39](https://github.com/ramiz4/riparim/pull/39) corrects
  Cloudflare HTML normalization and enforces the same contract in the release.
  The native Miniflare regression reproduced the error and checks GET/HEAD,
  unchanged bytes, dynamic root page and missing files.

Both code corrections passed standards/spec reviews, full tests, TypeScript,
catalogue checks, lint and Cloudflare/Sites builds and packaging.
Lint retains seven existing warnings with no errors.

v1.2.9 was published automatically on October 5 at 05:41:24, deployment
`961b802f-0987-47aa-99e8-af5165a6ba67`, version
`c4d865d2-3702-402f-993c-54c568083ecb` with 100 percent traffic.
Apex and technical host served HTTP 200 and the embedded main commit.
The ownership file returned direct HTTP 200 for GET and HEAD, without Location;
GET contained unchanged verification bytes. Three HTTP/www checks confirmed
HTTPS and the preserved search path with query.

Final production verification started on October 5 at 05:42:31.
**Five production preflight checks and 15 Auth/private-file checks passed.**
Three marked, random test accounts were confirmed created and logged in through
the production email/password endpoint. Preflight checks use invalid/missing
callback tokens; they confirm no new email delivery. Actual Google login and
return navigation are proven separately above.

Checks covered anonymous and forged Sites identity, rejected customer access
on administrative endpoints, actual admin rights, a private pending visit with
a synthetic PNG file, own/admin file access, rejected foreign and anonymous
access, exclusion from public reviews, no delivery event for the pending visit,
session revocation on blocking and logout, and required new login after
unblocking. No actual review was moderated; decision/notification contracts are
covered by isolated tests. Confirmed legacy links were counted in the final
inventory: zero existing records; linking and ownership are verified in fixtures.
Additional read-only probes with forged Sites headers returned HTTP 401 for
`/api/auth-settings` and `/api/business`; `/api/account` returned only
`account: null` and `deletionReady: false`.

**Cleanup confirmed:** all three test accounts, their roles/status/sessions,
the pending visit and its private file were removed. Zero remaining test
accounts, zero cleanup errors; the private R2 inventory then held zero objects.
D1 then contained zero visits, upload reservations and delivery events;
163 workshops, 78 approved, remained. Existing shared IP limits were preserved.
No actual emails were sent. The protected journal has identifier
`3cce58df-259a-4461-9d0f-79a0e298feac`.

## Observation, acceptance and fallback

First actual observation: October 5, 04:57:35 to 05:36:06. Cloudflare aggregates
show 230 fetch and eight scheduled invocations with outcome `ok`, no HTTP 5xx.
86 HTTP 404 responses concerned automated requests for nonexistent Git,
environment and configuration files, WordPress and `.well-known/ucp`;
no verified app page was among them. No navigation or Google authorization
errors were captured in the browser. This proves the stated period, not
arbitrary future availability. Only counts and categories were stored.

**Technical operator acceptance: Go on October 5 at 07:16:24.** The responsible
owner is the operator agent autonomously assigned in this chat.
Technical observation ran from 04:57:35 to 07:16:24, or **2 hours, 18 minutes
and 49 seconds**. The last complete aggregate reconciliation covers 584 fetch
and 27 scheduled invocations with outcome `ok`, no Worker execution errors
and no HTTP 5xx. The HTTP 201 response belongs to the documented private test
visit above, whose cleanup was confirmed. Permission denials and nonexistent
paths were not counted as successful business actions.

Five fresh final probes confirm HTTP 200 and the release commit on apex and
technical host, canonical www redirection preserving query, the direct Google
ownership file and actual maintenance text with `no-store` on the old generated
URL. The authenticated Sites query still confirms `MIGRATION_READ_ONLY=true`,
environment revision 17.

All #19 requirements are therefore technically proven: protected configuration
and identities, production Auth/permission checks, DNS/TLS, complete final
reconciliation, sole writer, justified Go/No-Go with a reviewed forward fix,
observed business flows and further automatic main releases.
Successful technical acceptance permits closure of this domain cutover issue.
Further operational observation may continue without reopening the completed
technical cutover.

**At the time of this operator acceptance, the agreed end of the separate
fallback period for #20 was still unresolved.** The earlier proposal of
October 6, 05:00 was not confirmed. Personal user acceptance is not claimed
to have been granted. Technical operator acceptance from #19 replaces neither
that agreement nor authorization for final deletion. Old publication, domain
mappings, access and backups are preserved until the proven end of the fallback
period; inventory, archive and retirement plan may be prepared.

A code error is preferably resolved through a reviewed forward fix via main;
successful acceptance fixes already demonstrate this path in production.
A code rollback resets no D1/R2 data. Routing to the old Site may occur only
after an announced write pause on both sides, new backups, full reverse transfer
of all changes/deletions/files created since cutover and renewed Auth/permission
reconciliation. Unverified routing back to the frozen old database is not an
authorized return path.

After the agreed period ends, #20 covers inventory, archive/retention, intended
behavior of old URLs, controlled disabling of publication, domain mappings and
old background work, and selective revocation of only old access.
Shared Supabase/Google/email services remain. Final resource deletion requires
separate authorization after retention expires.

The later user decision “Ja, jetzt stilllegen.” (“Yes, retire it now.”) ended
this period at 09:51:01.
The [retirement evidence](sites-retirement.md#completion-evidence-from-october-5-2026)
documents execution until 09:58:38, subsequent Auth/file QA, preserved resources
and minimum retention until November 4, 2026.
