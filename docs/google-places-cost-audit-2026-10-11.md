# Google Places cost audit on 2026-10-11 (#96)

[Operations runbook and recovery](google-places.md#operation-costs-and-outage-path-96).
This dated report separates synthetic app counts, actually read provider data,
persisted changes and outstanding checks.

## Request model and SKU mapping

The comparison baseline is `2d593346c2337f827801835787bd4f4424da5ccc`
(2026-10-10); the after state includes #94 and #95. The matrix below counts app
request triggers with enabled Google configuration, confirmed identity, the same
language and successful responses. The temporary browser pause documented below
is a separate current operational state. The twelve-card/filter/pagination before
values were run with the same SDK fixture against an isolated source archive of
the baseline; other before values follow the sources and red fixtures from
#94/#95 at the time. After values are verified by the two named request fixtures.
They are **not production measurements or an invoice**.

| Scenario                                                            | Before                                                                                                        | After                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Name sorting, twelve cards visible for the first time               | 12 individual rating requests                                                                                 | 12 individual rating requests                                          |
| Filter with no matches, return to the same twelve visible cards     | 12 additional rating requests after fully filtering them out/in                                               | 0 additional rating requests                                           |
| Show twelve more cards, still not visible                           | 0 additional rating requests with name sorting                                                                | 0 additional rating requests                                           |
| Those additional twelve visible for the first time                  | 12 additional rating requests                                                                                 | 12 additional rating requests                                          |
| Old `sort=google` link, 158 synthetic matches, no visible card      | 158 rating requests in the red run                                                                            | 0; URL normalized to name                                              |
| Profile mount, Google sections not visible                          | 1 complete Enterprise details request in the red run                                                          | 0 Google requests                                                      |
| Google section visible, including reviews                           | Additional standard widget; header uses complete profile response                                             | 1 shared standard widget, no header rating request                     |
| Photo section visible                                               | Photos from complete profile response                                                                         | 1 separate metadata request `id,photos,attributions`, up to 3 previews |
| Open gallery / select another photo                                 | Selected large file; additional previews possible in dialog                                                   | Selected large file; additional previews possible in dialog            |
| Successful profile open for 30 minutes, no opening-hours transition | Complete profile refresh every 5 minutes; for a known transition up to 30 minutes or transition + 1.5 seconds | 0 automatic requests; stale-state display                              |
| Explicit visible refresh after staleness                            | Complete profile refresh through timer/tab return                                                             | 1 new standard widget, 0 photo metadata requests                       |

Filter/gallery values guarantee nothing for arbitrary navigation: a new ID,
locale, browser run or reopening discards the respective display state.
Fixtures do not measure browser caching, native widget internal requests,
image lazy loading or Google billing events. Creating a widget in particular
does not guarantee a specific SKU request count.

| Current call                                                                     | Google SKU / quota family to verify                                                |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Visible catalogue rating, JS `rating,userRatingCount,googleMapsURI,attributions` | Place Details Enterprise; Places/Maps JavaScript project quotas                    |
| Standard `gmp-place-details`, rating/opening hours/reviews                       | Places UI Kit Query Essentials (`0678-4F72-DA7C`), regardless of content selection |
| Photo metadata `id,photos,attributions`                                          | Place Details Essentials IDs Only; no Enterprise fields                            |
| Preview and large image `/photos/.../media`                                      | Place Details Photos; consider each actual image request separately                |
| Server-side `places:searchText` with phone number and own location check         | Text Search Enterprise; all search modes share the app limit                       |
| Identity check `addressComponents` for candidates without a country              | Place Details Essentials; also counts toward the app limit                         |
| SDK loading, direct Maps/directions links                                        | SDK loading and external links are not an embedded map; no app Route API request   |
| Advanced/Pro UI Kit or Dynamic Maps                                              | Not used in the current public profile; investigate unexpected invoice rows        |

The highest requested field tier determines the details/search rate.
The table maps source code to official contracts; proof of actually billed SKU,
free allowances, currency and special rates comes exclusively from Google Cloud
Billing. The billing address determines regional contract terms, not workshop
locations. Without confirmed remaining free SKU allowance, no Google API probes
or daily research API requests are performed; research then uses official Maps
interfaces or is deferred. Enable no paid plans, projects or additional services.

## Observed operational evidence on 2026-10-11

Usage, prices and configuration were checked read-only in the signed-in Google
Cloud project `riparim-510521`; afterward only the quotas/referrers evidenced
below were changed. No services, paid plans or provider probes were enabled.

| Source / period                                                                               | Actually observed                                                                                         | Limit of inference                                                                            |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| API dashboard, 2026-10-10 00:42:26 UTC to 2026-10-11 00:42:26 UTC, “1 Tag” (one day) selected | Places API (New): 143 requests; Places UI Kit API: 1 request; displayed errors: 0                         | API aggregates, no SKU/billing mapping or separate before/after measurement                   |
| API dashboard, same period                                                                    | Maps JavaScript API enabled, request display “—”                                                          | No proven zero usage                                                                          |
| Billing account overview, current month 2026-10-01–11                                         | Total cost 2.73 CHF; savings 0.00 CHF; account already listed as “Kostenpflichtiges Konto” (paid account) | Account total, not yet proof of Riparim project/SKU costs, free allowances or contract region |

The account-wide tabular report **“SKUs – diesen Monat”** (SKUs this month) has visible data for
**2026-10-01–10** and contains nine SKU rows from three services:

| SKU                               | SKU ID           | Usage quantity (“count”) | Displayed cost |
| --------------------------------- | ---------------- | -----------------------: | -------------: |
| Place Details Enterprise          | `2D9A-3DE0-3766` |                     1164 |       2.73 CHF |
| Places UI Kit Query               | `0678-4F72-DA7C` |                       37 |       0.00 CHF |
| Text Search Pro                   | `4FDA-34B1-A910` |                        1 |       0.00 CHF |
| Place Details Essentials IDs Only | `5C36-E272-E88F` |                        2 |       0.00 CHF |
| Text Search Essentials IDs Only   | `635D-A9DD-C520` |                        1 |       0.00 CHF |
| Place Details Essentials          | `6E05-E1C3-8D85` |                      126 |       0.00 CHF |
| Place Details Photos              | `DCD1-FE97-8C71` |                      144 |       0.00 CHF |
| Text Search Enterprise            | `E967-44BC-B44D` |                      472 |       0.00 CHF |
| Dynamic Maps                      | `FAF4-3B2D-51B2` |                        1 |       0.00 CHF |

These are **quantities and costs actually displayed in the billing report**,
not a pricing scenario. The report assigns 2.73 CHF to Enterprise Details;
the separate project billing table lists only Riparim (`riparim-510521`) at
2.73 CHF for the same period. This table contained no Pro UI Kit row; no zero
usage is inferred from that. The billing overview extends through October 11,
but visible SKU data only through October 10; after billing for #94/#95 is
therefore not yet proven. Free rows do not prove remaining free allowance for
another probe. Currency and account status prove neither an individual SKU's
price tiers nor the billing address. The existing account plan was not enabled
or changed. Without confirmed remaining free allowance, no additional potentially
billable API requests are made for measurement.

Payment settings confirm **Switzerland (CH) as the billing country**.
No address or payment details were copied. The account's own **“Preise”** (prices) table
shows these current default list-price tiers in CHF per 1000 events (rounded);
no special discount is proven:

| Relevant SKU                              | Free tier according to account table           | First paid tier, CHF/1000 |
| ----------------------------------------- | ---------------------------------------------- | ------------------------: |
| Standard UI Kit Query                     | Up to 10000 monthly events                     |                   0.83185 |
| Place Details Enterprise                  | Up to 1000                                     |                    16.637 |
| Place Details Photos                      | Up to 1000                                     |                   5.82295 |
| Text Search Enterprise                    | Up to 1000                                     |                  29.11475 |
| Dynamic Maps                              | Up to 10000                                    |                   5.82295 |
| Place Details Essentials                  | Up to 10000                                    |                   4.15925 |
| Details / Text Search Essentials IDs Only | Table price from event 0 is 0 CHF each, unit 1 |                         0 |

These account price tiers supersede global USD model prices. The already reported
1164 Enterprise Details events exceed the free 1000; no remaining free allowance
for this SKU is proven in the current month. The actually reported 2.73 CHF
remains a separate observation, not an invoice calculated from the pricing table.
Price tiers, billing lag and other billing account consumers must be rechecked
before further live probes; free rows alone do not authorize additional calls.

The current **Budgets & caps** screen contains no budget rows; no effective
budget warning or automatic shutdown is therefore proven. The current budget
form additionally contains an **“Erzwingung der Ausgabenobergrenze”** (spending-cap enforcement) option,
but its selectable services are exclusively Cloud Run, Cloud Run Functions,
Gemini API and Vertex AI. Maps/Places cannot be selected. This unsaved draft
was cancelled after read-only inspection; no budgets, caps, alerts, automatic
emails, Pub/Sub, BigQuery or Cloud Run services were created.
A notification budget without effective enforcement stops no Maps usage.
The chosen warning process remains daily manual billing checks against the
last evidenced 2.73 CHF and its SKU/event date; reporting lag must not be
presented as current new usage. Manual warning thresholds are 50/80/100% of
confirmed free SKU allowance: Enterprise Details/Text Search Enterprise/photos
500/800/1000, standard UI Kit 5000/8000/10000. At 80%, check remaining allowance,
lag and daily limits; at 100%, pause the relevant API path. Enterprise Details
at 1164 is already above 100%; the browser pause is documented below.
Any increase above 2.73 CHF is separately checked against event date and reporting
lag. These are manual observation thresholds, not created budget alerts or
monetary budgets. The following Places API (New) quotas were shown as adjustable
in the UI; the table records **before state and return path**:

| Method            | Previous daily limit | Usage at first check | Previous per-minute limit |
| ----------------- | -------------------: | -------------------: | ------------------------: |
| GetPlaceRequest   |               125000 |                   97 |                       600 |
| SearchTextRequest |                75000 |                   45 |                       600 |
| PhotoMedia        |               175000 |                    1 |                       600 |

Displayed per-minute usage was zero in each case; that is not monthly usage.
These generous previous limits guarantee no free usage. Other enabled quotas
and services were not changed. Quota counts replace neither account price-tier/
contract-region proof nor checks of billing lag.

The generic **IAM quota view** filtered to `placewidgets.googleapis.com` proves
UI Kit quotas. The product-specific Maps quota link redirected to “alle Maps APIs” (all Maps APIs)
and therefore is not used as proof of a UI Kit limit.
The also-adjustable previous UI Kit state was:

| UI Kit method             | Previous daily limit | Usage at first check | Previous per-minute limit |
| ------------------------- | -------------------: | -------------------: | ------------------------: |
| Query Requests (Standard) |            Unlimited |                    1 |                      6000 |
| Advanced Requests         |                 8000 |                    0 |                 Unlimited |
| Sessions                  |            Unlimited |                    0 |                      6000 |

The account's own standard-query price tier read above states 10000 free monthly
events; billing lag and other consumers must still be included when checking
remaining allowance. Selected limits of standard/day 30, advanced/day 0 and
sessions/day 0 protect the current standard-only usage and block unused
Pro/autocomplete paths. These three daily limits were then saved in GCP;
the interface confirmed three updated limits and displayed standard **30**,
advanced **0**, sessions **0**. Per-minute values remained 6000/Unlimited/6000.
An exact write time was not recorded; fresh persisted readback at
**2026-10-11 01:07:43 UTC** confirms these three values after propagation time.
Old values provide the return path. After exhaustion of the small standard daily
limit, the Maps fallback is available instead of a zero rating.

On **2026-10-11**, **GetPlaceRequest per day was reduced from 125000 to 0**.
The native GCP form accepted the value, confirmed a 100% reduction and reported
that the requested limit was updated. Table readback shows **0 with override**;
already incurred daily usage of 97 remains visible as history. No actual Places
request was performed as a countercheck. Renewed read-only inspection at
**2026-10-11 01:10:06 UTC** confirms GetPlace **0**, SearchText **20** and
PhotoMedia **20** after propagation time. This does not claim a complete global
blocking effect.

This manual GetPlace block affects REST photo metadata (including Essentials
IDs Only) and supplementary server-side country details; uncertain new
publications are deferred. Existing owned profiles, reviews and confirmed
Maps/directions links remain usable. Old browsers may retain already loaded
displays. Other methods, especially Text Search, PhotoMedia, UI Kit and Maps
products, are not claimed disabled by this. The block is also intended for SDK
individual ratings; however, exact enforcement of `Place.fetchFields` through
the GetPlace daily quota was not proven by a live probe. The official
[Maps JavaScript usage documentation](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
lists new Places library SKUs separately and confirms that UI Kit subrequests
to Places/Geocoding do not consume their project quotas. UI Kit therefore
remains constrained by its own quotas. The
[Places usage documentation](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
describes separate method quotas for Places (New), but alone does not prove SDK
GetPlace enforcement. There is no automatic monthly reactivation or general
monetary cap; raising limits requires manual verification of billing reset,
lag, remaining free allowance and other consumers. SearchTextRequest/day **20**
and PhotoMedia/day **20** were then saved with success confirmation.
Initial tables still showed old values; the fresh readback above confirms both.
Persisted UI Kit daily limits are above.

Before the changes, the browser key detail page showed **“Website-Beschränkung”** (website restriction)
and exclusively **Maps JavaScript API, Places API (New), Places UI Kit API**.
The seven original referrers were `https://riparim.com/*`,
`https://mjeshter-kosovo.r-loki.chatgpt.site/*`, `http://127.0.0.1`,
`http://127.0.0.1:5175/*`, `http://127.0.0.1/*`, `http://localhost`,
`http://localhost/*`. There is no general domain wildcard and no `www` entry.
Legacy Sites and loopback are unnecessary for current production; reduction
first requires secure matching to the actually served runtime browser key and
a backup of the old list. An additional host is authorized only if demonstrably
necessary; a redirect alone needs no Google referrer. The server key list shows
only Places API (New); its detail page confirms that single API and no application
restriction. Fixed Cloudflare outbound IPs are not proven. The production browser
key from the configuration route was matched to the named GCP key exclusively
through an in-memory SHA-256 comparison; no key values or hashes are documented.
Then exactly the six legacy/loopback referrers were removed and exclusively
**`https://riparim.com/*`** was saved. Navigating again from the credentials list
to the key showed only this referrer with the same three APIs. The save check
is evidenced by tool clock **2026-10-11 01:00:33 UTC**; GCP states up to five
minutes of propagation. Later readback at **2026-10-11 01:09:12 UTC** confirmed
this apex state. Local fixtures need no real provider key.

### Temporary browser pause instead of an unproven SDK blocking guarantee

The official [Places library setup](https://developers.google.com/maps/documentation/javascript/place-get-started)
names Places API and Places API (New) for new text search/autocomplete;
it proves no unambiguous `fetchFields` enforcement through GetPlace/day.
GetPlace 0 alone is therefore insufficiently proven as a cost block for SDK
individual ratings. Without a potentially billable countercheck, the browser
key demonstrably used in production was instead deliberately **temporarily paused**.

On **2026-10-11 01:11:45 UTC**, the sole apex referrer was replaced by exactly
**`https://riparim-google-paused.invalid/*`**, without an empty allow-all list,
key deletion/rotation or new APIs. Fresh navigation from the credentials list
and observed loading confirm in persisted detail readback at **01:12:07 UTC**
the single `.invalid` referrer and unchanged three allowed APIs.
Renewed read-only inspection after five minutes, no earlier than **01:16:45 UTC**,
must be assessed separately from configuration evidence; this report claims no
observed live SDK authorization error or complete cost stop.

The provider website restriction blocks the normal production browser path
independently of the uncertain SDK method quota: individual ratings, opening
hours, reviews, photo requests and standard UI Kit are temporarily unavailable.
Runtime configuration remains **`enabled:true`**; no secrets were removed.
Owned profiles/reviews and direct Maps/directions links remain usable.
Already open displays, propagation time, billing lag and the separately usable
server key are limitations; referrer rules are no general monetary cap.
The server path remains separately bounded by GetPlace 0/SearchText 20 and may
be used for research only with confirmed free remaining allowance; otherwise
use Maps UI or defer. Other small daily quotas remain for later controlled
reactivation.

The specific return path is exclusively **`https://riparim.com/*`**; the six
old dev/legacy referrers remain removed. Lift the pause manually only after
confirmed free remaining allowance and reliable proof of SDK quota enforcement
or another confirmed free display path. No automatic monthly reset.
After SDK authorization errors, deliberately reload because the SDK retains
its rejected load state in an open browser. Existing offline error checks and
those added here prove owned profiles/reviews and Maps fallbacks without false
zero ratings or automatic retries; they are no live SDK probe.
An HTML-only live check of the three catalogues and three AHP profiles in
DE/SQ/EN returned HTTP 200/DOCTYPE without Cloudflare 1102, but executed no
JavaScript and made no Google request.

The generic quota view for **Maps JavaScript (`maps-backend`)** shows map
loads/day **Unlimited**, current daily usage **0**, per minute **30000** and
per minute/user **300**; the quota is adjustable. Then only map loads/day **30**
was saved and confirmed in success message/table (verified tool clock no later
than **2026-10-11 01:02:04 UTC**). Other Maps/static/3D/grounding methods are
unchanged. The current app initializes no embedded map; old browsers or provider
internals may still have separate triggers. SDK loading and direct external
Maps/directions links are not claimed map-load pricing events.
Account monthly count 1 plus 22 more daily windows × 30 gives 661 modeled
triggers against the confirmed free 10000 tier; this is no actual after
measurement or monetary cap. Later fresh readback at
**2026-10-11 01:07:21 UTC** confirms map loads/day **30**;
previous values provide the return path.

## Limiting model and open controls

The implemented GetPlaceRequest/day block **0** remains until the stated
reactivation check. SearchTextRequest/day **20**, PhotoMedia/day **20** and
standard UI Kit/day **30** were also saved successfully and freshly confirmed
read-only after propagation. Readbacks documented above confirm configuration,
not live SDK enforcement or a complete monetary cap. GetPlace 0 deliberately
also blocks free photo metadata and server-side country details; unresolved
new publications are deferred. Standard UI Kit is also temporarily unavailable
through the browser pause; its own quota provides additional protection for
later controlled reactivation, not current usage authorization.
With 45 searches already made that day, SearchText 20 means a deliberate daily
outage, not silent additional usage.

As a precaution, respective current daily counts (45 search, 1 photo, 1 UI Kit
trigger) are added to quantities reported through October 10, even though they
may partially overlap. With another 22 possible daily reset windows and the
saved daily quotas, the model yields **957 Text Search, 585 photo and 698 UI Kit
triggers**. These are below the account's free tiers of 1000/1000/10000 provided
no further unreported or unrelated billing usage is added. This model describes
daily quotas independently of the additional browser pause; it is no invoice
and assumes matching SKU/quota mapping, confirmed free allowances, accounted
other billing consumers and time boundaries. Even a later full 31-day month
would yield 620/930 triggers at 20/30 daily triggers; no automatic reset of the
GetPlace block is configured or claimed. Raise the limit only manually after
checking billing reset, data lag and new free remaining allowance.
Old values in before tables provide the return path; for a zero-cost assignment,
do not restore those high limits without verification. Already loaded browser
displays remain until reload; provider blocks may have propagation delays.
