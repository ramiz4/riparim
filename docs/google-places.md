# Google assignments and Maps links for Riparim

Google keys are configured in the hosted runtime. Google stars and counts are no longer loaded or displayed publicly; historical snapshots continue to be excluded from sorting. All **177 published automotive service businesses, including vehicle detailing**, have an unambiguously confirmed Place ID. Assignments are checked individually against official maps, businesses' own websites, or matching independent contact/location evidence. On October 5, 32 confirmed IDs were added; two existing identities could be published after correcting outdated directory locations. `google.verification` documents the method, evidence links, and independently authored verification note. Auto Electronics is among the 27 drafts without an unambiguous assignment removed at the user's request. The six scope exclusions justified in `data/workshop-scope.json`, the Opel Rakovica business independently proven closed, and the old southern Reno profile were removed after final review at the user's request. The substantiated northern Reno location is listed as a new public profile. Google ratings, reviews, photos, and opening hours are loaded neither in the catalogue nor in workshop profiles. Maps and directions links remain external links. Actual display also depends on the available Google integration in the browser.

The central import source is `data/workshops.json`; it contains profiles, stable Riparim IDs, Google assignments, and substantiated snapshots separately. Data format, inventory review, and import commands are documented in `docs/workshop-data.md`. API content is not stored permanently in Git; a Google bulk export requires appropriate data rights.

On October 4, nine additional drafts were individually confirmed and published. Thirteen independently substantiated Plus Code addresses were converted offline into precise coordinates and checked against the existing Google entry. Two further checks found unresolved location conflicts for Autodiagnoza Kosove and BMW Service Ferizaj; these profiles were hidden at that time pending independent clarification. Identifiers, historical assignments, and ratings are preserved. The inventory at that time therefore contained 78 published profiles, 19 with precise coordinates, and 85 drafts. Independently authored evidence is recorded in `data/catalogue-review-2026-10-04.json`.

On October 5, all 85 remaining drafts were reviewed and **34 approved**. Autodiagnoza Kosove and BMW Service Ferizaj retain their existing IDs; their current locations are now precisely substantiated by the businesses' own sources. After this first review step, the inventory contained **112 public profiles, 21 with precise coordinates, and 51 drafts**. At that time, 45 of those needed further identity evidence; six remained excluded from scope. The publication gate and daily limit of 100 server-side identity queries remain in place. `data/catalogue-review-2026-10-05.json` documents every review outcome. No new Google API content was stored permanently.

Subsequent review of the 51 drafts confirmed **13 more IDs**. Current business sources resolve old contact details and names; precise profile-specific directory markers confirm Kimi and Gazi despite missing Google phone numbers. Every ID was verified directly through Google Maps with a deliberately mismatched fallback search to resolve to exactly the same business. No additional server queries or relaxation of identity checks were needed. After this review step, the inventory contained **125 public profiles, 23 with independently substantiated precise coordinates, and 38 drafts**. Thirty identities, one Reno branch continuity question, one substantiated closed business, and six scope exclusions remained open or hidden at that time. The complete follow-up report is `data/catalogue-followup-2026-10-05.json`.

Further review of these 30 identities confirmed **three more existing profiles**: Sfishta Auto Home, Niki, and Fatosi. Their own advertisements, business posts, official alias evidence, and precise independent business points connect each existing business to its valid Google entry. Direct ID verification used the Gmail browser profile specified by the user; no further server queries were performed. After this review step, the inventory contained **128 public profiles, still 23 with independently substantiated precise coordinates, and 35 drafts**. Twenty-seven identities still need unambiguous evidence; the other eight drafts remain unchanged. All 30 outcomes are recorded in `data/catalogue-identity-2026-10-05.json`.

The 27 identities subsequently rejected by the user are documented in `data/workshop-removals.json`. After this first removal, the inventory contained **128 public profiles and 8 drafts**, or **136 profiles** in total. After completion on October 5, the catalogue contained **129 public profiles and no drafts**. Associated cache/map metadata is removed; removal markers prevent reimport. Earlier review outcomes and their counts at the time remain as history.

## Configuration in the existing Riparim Google Cloud project

1. Maps JavaScript API, Places API (New), and Places UI Kit API are already enabled. Before changing existing usage, apply the billing/free-allowance/quota checks documented below; enable no additional services or paid plans.
2. Allow the production browser key only for HTTPS referrers actually needed and Maps JavaScript and Places UI Kit (no Places API (New) in the browser key). Proven production runtime assignment is authoritative; an old Sites host or local fixtures do not justify allowing the production key.
3. The separate private server key may use only Places API (New) and stays in the protected server runtime secret. Without a fixed, substantiated Cloudflare egress IP, do not configure an unverified IP restriction.
4. `GOOGLE_MAPS_BROWSER_API_KEY` and `GOOGLE_PLACES_SERVER_API_KEY` belong exclusively in protected runtime configuration. Publish the app through a verified main release according to `docs/releases.md`; no keys in Git or `.openai/hosting.json`, and no manual feature-branch publication.
5. Check actually supported quotas and existing billing warnings. A notification budget does not stop usage; the app limit of 100/day limits only server-side identity queries. Effective current values, intended changes, and the return path are documented in the operations runbook below.
6. Live validation is only a bounded step with a confirmed remaining free allowance. Without that allowance, isolated failure/request fixtures and read-only provider configuration are sufficient; direct Maps links remain available, and errors are not presented as missing ratings.

## Existing Google Maps links as identity

Stored links are evaluated first. `query_place_id`, `place_id`, and `q=place_id:…` identify the entry directly and require no new search request. A CID link is confirmed through the identical CID in the Maps link returned by Google. Foreign domains and search text are never treated as a Place ID.

For search links, their existing search query, including address, is used. A unique result must also be confirmed by phone number or a matching name and precise location (substantiated coordinates, Plus Code, or at least two matching address words). A search link alone does not prove identity. Confirmed links are stored with the Place ID; the contact link and embedded rating area use the same entry. A changed link invalidates the assignment cache.

## Assignment and presentation

A published profile requires confirmed Google identity even when no reviews or stars exist. The import validator and administration route check this prerequisite. An unchanged confirmed profile retains its identity; changes to name, phone, town, address, or coordinates require new confirmation. Duplicate Place IDs are rejected. Map links, directions, ratings, and opening hours use the same ID. Opening hours appear only in the native Google component in the profile header; photos stay on Google Maps. Content is not adopted into the import source.

The public assignment route accepts only an existing published
workshop identifier and reads its already confirmed Place ID from the
direct Maps link or existing `workshop_google_places` record with
a valid ID and matching business-data hash. Profiles without a historical
Google snapshot therefore also retain their confirmed identity. It starts
no Google search, updates no assignment record (the existing catalogue bootstrap remains unchanged), and uses
no new Google details. Without a confirmed unchanged ID, it returns `placeId:null`, and the
UI offers the existing Maps link. New or changed business data
is confirmed exclusively through the separate verified publication/research procedure.
The following search rules apply to that server-side procedure.

Phone queries use a space after the country code and its corresponding region code: `+383`/`XK`, and existing `+381` numbers unchanged with `RS`. Known workshop coordinates set a search bias of three kilometres; without coordinates, the Kosovo area is used. Search therefore does not depend on the server's egress IP. Final country and location verification remains independent; after an unsuccessful phone search, a search by workshop name and town follows with the same strict identity checks. Missing structured country information is checked through Place Details for candidates with a matching phone number. All search and details requests count toward the shared limit of 100/day. Joined names such as AutoMita are recognized; charging stations, car parks, and car-wash-only businesses are excluded. When the search strategy changes, its version identifier makes previous unsuccessful assignments eligible for rechecking.

Only Place IDs and independently authored verification/retry metadata are stored permanently. Unresolved results are checked again after seven days, provider errors no earlier than after 15 minutes. Concurrent calls share a short lease. A profile change triggers a new assignment; successful assignments are checked again after one year.

Visible cards show current stars and counts in the native Google Advanced
UI Kit widget. The app exports no rating values and stores no
API stars or reviews in D1, R2, or browser storage. Google and
provider attribution remain in the component. Google values contribute neither to
Riparim averages nor to Riparim sorting.

The catalogue offers only name, Riparim rating, and distance as sorting options. Old links with `sort=google` normalize to the default name sort; search term, service, town, brand, language, and locale are preserved. There is no global Google sorting or Google sorting limited to the first twelve results. Historical Google snapshots continue to be neither displayed as current nor used for sorting.

Google components start only when visible and the tab is active
(with a 120-pixel preload margin). An unchanged widget remains
connected in the current component state; filters hide and show the entire already mounted card.
These card IDs remain limited to the current published catalogue;
no Google values are extracted. Locale/identity changes remove old
Google content. A new sort, changed distance origin, or changed
sort order in the live catalogue starts a new view so DOM and
keyboard order match the visible sort. There is no content
cache, TTL, background refresh, or writing to D1, R2, Redis, CDN, or browser
storage. Place ID assignment and direct Maps fallbacks are preserved.

A change to the central JSON source triggers import through its content hash; profiles and researched Google information are updated according to their separate timestamps. Newer manually maintained information is preserved.

### Historical request evidence for Issue #94

At completion of #94, `tests/catalogue-google-requests.test.mjs` used 158 synthetic public workshops, controlled visibility, and a Google SDK fixture without real provider calls. The red run before the change counted **158 Places queries** with `sort=google`, even though no card was visible. The same run after the change checked in DE/SQ/EN:

| Trigger                                             | Places queries after change |
| --------------------------------------------------- | --------------------------: |
| Initial render with 158 results and invisible cards |                           0 |
| Old URL `sort=google`                               |                           0 |
| Filter change, new cards still invisible            |                           0 |
| First visible card                                  |                           1 |
| Matching card visible again after a filter change   |                0 additional |
| Locale change and first card becoming visible again |                1 additional |

At that time, the same fixture also checked the data-free static catalogue shell in DE/SQ/EN: hydration reads every filter and the locale from the real URL; the existing live catalogue fetch remains and causes no Google query for invisible cards. Visible cards and their reuse retain the same request counts. The current test uses 160 synthetic records and checks zero Google requests even for visible catalogue cards; the counts above describe the SDK individual-rating path at that time.

Calls counted then were SDK `fetchFields` requests, not a cost measurement or a claim about billing categories. Ordinary URL/sorting contracts, loading/empty/error cases, and late responses are also checked without live Google connections.

## Historical UI Kit operation in workshop profiles (through v1.26.2)

Riparim's own reviews or their empty-state message always precede Google. The Google host therefore stays at the same DOM position during loading and is neither moved nor reconnected; its own panel visibility continues to control fetching. This does not imply anything about Google's internal billing behavior.

The profile uses two separate Advanced UI Kit components: in the profile header,
`gmp-advanced-place-details` shows only `gmp-place-rating`,
`gmp-place-opening-hours`, and `gmp-place-attribution`. Below Riparim's own
reviews, `gmp-advanced-place-details` shows only `gmp-place-reviews` and
`gmp-place-attribution`. Both use the same confirmed identity and
active language; they share the assignment route. Each component
starts only when it becomes visible. The additional app heading,
repeated workshop name, and native Maps actions are omitted. Opening hours
appear only at the top; Google comments appear only in the reviews area.
There is neither a parallel Enterprise profile query nor a full
REST refresh at the next opening/closing transition.
Native Google presentation distinguishes missing reviews, unknown
opening hours, and closed status. The app does not read this data from the DOM,
shadow DOM, or widget. The documented public `place` property
contains only ID, location, and viewport. A failed provider call
is displayed as a loading error, never as zero reviews.

Each component starts only when visible (120-pixel preload margin) and the tab is active.
Configuration and the assignment route start only when the Google area is visible
and the tab is active.
The public assignment route reads only the already confirmed ID. After waiting for
configuration, current visibility is checked again; if the area
is invisible, assignment is deferred until it becomes visible again.
Visibility is also rechecked after asynchronous SDK loading. Theme changes
and ordinary profile state changes
preserve the same widget instance; colors and fonts are changed only
through official CSS properties and `color-scheme`. The
reviews component uses the full main-column width with internal scrolling;
the borderless profile header gets a height of 152 pixels and the same internal scrolling for
expanded weekly hours. The full component is required because
`gmp-place-opening-hours` is supported only there according to the content reference;
the compact example in Google's Advanced guide does not show these hours in the live SDK.
Spacing is reduced only through the documented
`--gmp-mat-spacing-*` properties. Source attribution and the information function
remain visible; their native order is unchanged. Catalogue ratings
retain the compact component with content height.
The component's Google and author attribution remains complete.
The profile uses no summaries or `all-content`.

Load time remains internal staleness metadata. After 30 minutes,
the respective old component is hidden and a clear
staleness indicator is offered. Status, the compact localized action **Erneut laden** (“Load again”), and
the Maps fallback appear in a wrapping row. On SDK loading errors, the
action remains **Seite neu laden** (“Reload page”) and actually reloads the browser. The
timer changes only the display: it starts no Google query.
Returning to the tab also does not refresh automatically. Only the
explicit action in a visible area with an active tab replaces the widget instance;
it loads neither individual details nor photo references. Internal queries by the
Google component belong to the provider contract and cannot be inferred from app mocks
as actual billing events. When the provider is disabled,
times out, or reports a quota error, the confirmed direct Maps link remains available;
errors cause no automatic retry loop. An SDK loading error
explicitly offers **Seite neu laden** because the SDK loader retains its failed attempt
within the same browser run. With an already loaded SDK,
a widget error can be retried through the visible refresh action.

### Application-owned opening hours and profiles without Google queries

The catalogue and profile show only Riparim ratings. The profile starts
no Google configuration, identity route, SDK, widget, photo, or
details query. Maps and directions links are formed from existing confirmed IDs;
the browser opens Google only when an external link is clicked.
Server-side identity checks for catalogue and contact changes remain
separate. Existing provider quotas are not increased.

Opening hours are submitted through verified owner functionality and
published after moderation. Weekly schedules, exceptions, and the server-side
confirmation date belong in the app's database. Missing information is explicitly
unknown, not closed. Details are documented in [workshop-data.md](workshop-data.md).
Google hours are neither imported once nor synchronized. The dated
provider checks above and below document historical operation.

DE/SQ/EN catalogue and profile fixtures check zero Google requests, application-owned
ratings, opening hours, live hydration, empty states, and Maps links.

## Operation: costs and outage path (#96)

The [dated audit report from 2026-10-11](google-places-cost-audit-2026-10-11.md)
contains the reproduced before/after fetch comparison, all nine actually
observed SKU quantities/costs, Swiss account price tiers in CHF,
prior key/quota values, and measurement limitations. The project billing report at that time
showed **2.73 CHF**, including Enterprise Details with **1164 events** and a
free account tier up to 1000. #94/#95 are local request optimizations;
their production cost after the change is not yet proven because of billing delay.

### Provider approval: bounded Standard and Advanced widgets

The dated #96 report remains unchanged as historical evidence of the initial
browser pause. At the start of this correction, the browser key was still restricted to
`https://riparim-google-paused.invalid/*`. Standard approval has been
active since v1.12.7. Advanced was approved at 100 per day after a fresh account pricing/usage check
and verified main release v1.12.9. The profile split
uses this existing quota without further provider changes. Native
readback from 2026-10-11 confirms Advanced 100, Standard 250, and Sessions 0.

| Service / method                | Target daily limit | Effect                                                                            |
| ------------------------------- | -----------------: | --------------------------------------------------------------------------------- |
| Places (New): GetPlaceRequest   |              **0** | Individual details remain blocked                                                 |
| Places (New): SearchTextRequest |             **20** | Separate server-side identity checks only with confirmed remaining free allowance |
| Places (New): PhotoMedia        |              **0** | Public app loads no Google photos                                                 |
| UI Kit Standard Query           |            **250** | Only still-open older profile/catalogue views                                     |
| UI Kit Advanced Query           |            **100** | Separate profile components, without name/actions                                 |
| UI Kit Sessions                 |              **0** | Unused and blocked                                                                |
| Maps JavaScript: Map loads      |              **0** | No embedded maps; direct Maps/directions links                                    |

The browser key receives only **Maps JavaScript API and Places UI Kit API**
and exactly `https://riparim.com/*`. **Places API (New) is removed from this key**:
this blocks the former individual-details path independently of its unverified
SDK GetPlace quota assignment. The official UI Kit setup contract requires Maps
JavaScript and UI Kit; `PlaceDetailsPlaceRequestElement.place` accepts a
`Place` identity object or an ID. Creating `Place({id,
requestedLanguage})` loads no details; `fetchFields` is not called.
UI Kit widgets use their own quotas; according to Google, their underlying
Places/geocoding queries do not count against the corresponding project quotas.
GetPlace and map-load blocks therefore do not prevent UI Kit components.
Required content and Google attribution remain complete in the native widget.

The Swiss account pricing model from #96 has 10,000 free Standard UI Kit events
per month. Even across 31 full days, 250 per day yields at most 7750 additional
Standard queries for this project. The freshly read billing report from
2026-10-11 at 08:42:27 UTC reports 38 Standard UI Kit events with 0 CHF,
leaving 9962 units against the documented free account tier. Conservatively,
38 + 22 more daily windows × 250 = 5538 Standard events in the current month.
This is a control model, not live billing after the change. The same report shows
1261 Enterprise events with 4.34 CHF; these historical costs and
billing lag prove no free Enterprise return path. Already
consumed units, delayed reports, and
other shared billing consumers must be considered separately before approval.
No other project key may increase the quota or open a paid
fallback path. A daily quota is neither a global monetary cap nor a
monthly budget; the referrer pause remains if the remaining free allowance is unconfirmed.
The provider's daily reset timezone and reporting delay must be checked.

Advanced uses the separate SKU **Places UI Kit Pro (42AB-1FB3-B56A)**.
The [official price list](https://developers.google.com/maps/billing-and-pricing/pricing)
lists **5000 free events per month**, then 5 USD per 1000. Before activation,
the actual free Swiss account tier and previous account-wide
Pro usage must be freshly confirmed. The native account price list from 2026-10-11
confirms 0 CHF up to the 5000 tier boundary, then 4.159249999 CHF per 1000.
The current monthly report contains nine SKUs and no Pro UI Kit row; the total
4.34 CHF remains assigned exclusively to historical Enterprise Details.
The billing account is linked only to `riparim-510521`. Because of reporting delay,
this billing display alone does not prove zero usage; before approval,
the previous Advanced daily quota of 0 was additionally verified through usage readback.
Even across 31 days, 100 per day permits at most 3100 Advanced queries;
other account consumers and reporting delay must also fit within the remaining free allowance.
If the remaining allowance is unconfirmed, Advanced stays at 0; there is no paid fallback path.
Standard and Pro SKUs have separate free allowances. The Pro quota
must expose neither sessions nor additional content. This limit is not
a general monetary cap for the Google account.

The separate server key remains restricted to Places API (New), without a claimed
fixed Cloudflare egress IP. Public confirmed identity routes start no
new provider search. Research/reassignment may use server-side search only with
substantiated remaining free allowance; otherwise use the official Maps UI
or defer. No secret values, real account details, or Google content
are transferred into Git, D1, R2, or browser storage. Historical Google
snapshots remain unchanged and are not displayed as current values.

### Verification steps and return path

1. **Project/billing owner:** Filter billing reports by project, date, and
   SKU; distinguish gross usage, credits/discounts, and costs. Also check Switzerland/CHF account settings,
   price tiers, timezone, and reporting delay. API dashboard counts and
   missing SKU rows do not prove zero costs or remaining allowance. After release,
   compare the same traffic/time period; no additional backend telemetry is needed.
2. **Project/quota owner:** Read effective method/daily/minute quotas and API/referrer restrictions
   in existing project `riparim-510521`.
   Check UI Kit through IAM Quotas with `placewidgets.googleapis.com`. The app limit
   **100/UTC day** covers only identity search and supplementary country details;
   UI Kit widgets are excluded; individual browser ratings and images are removed. Before a change,
   record the old value, target, remaining free allowance, and impact. The
   [conservative remaining-allowance model](google-places-cost-audit-2026-10-11.md#limiting-model-and-open-controls)
   is neither a bill nor an overall monetary cap. The warning procedure is **daily manual
   billing inspection** against the last substantiated 4.34 CHF and relevant SKUs.
   Manual warning thresholds: **50/80/100%** of the confirmed free SKU allowance;
   Enterprise Details/Text Search Enterprise/photos each **500/800/1000**,
   Standard UI Kit **5000/8000/10000**, Pro UI Kit **2500/4000/5000**. At 80%, check remaining allowance,
   reporting delay, and daily limits; at 100%, pause the affected API path. Enterprise Details
   is already above that at 1261; this old path remains blocked. These
   observation thresholds are neither enabled budget alerts nor monetary budgets.
   An increase requires inspection of event dates/reporting delay, quotas,
   and other consumers, and the verified shutdown when needed. A
   notification budget alone does not stop Maps usage; without an authorized
   notification procedure, configure no automatic alerts.
3. **Runtime/release owner:** For the existing configuration shutdown,
   empty/remove `GOOGLE_PLACES_SERVER_API_KEY` or `GOOGLE_MAPS_BROWSER_API_KEY` in protected
   runtime configuration; Google routes return `enabled:false`.
   First secure restoration through the existing protected secret mechanism; write nothing
   to Git/logs. This also disables new identity checks for
   publication. Browsers retain configuration/SDK until reload;
   runtime shutdown does not terminate already open SDK instances.
4. **Restoration with UI Kit widgets:** Before approval, inspect the complete
   verified main release: no production `fetchFields` or
   REST photo requests. Check current billing, including shared
   account free allowance. Save daily limits according to the table above and read them
   back freshly. Assign only Maps JavaScript and UI Kit to the browser key, then allow exactly
   `https://riparim.com/*`; the six old development/legacy referrers remain
   removed. Wait up to five minutes for provider propagation, read back again, and
   use a new browser instance to check at most one visible area within
   the confirmed free quota. Deliberately reload after SDK authorization errors;
   no automatic retry loop. Configure no paid plans, subscriptions,
   budget/alert services, or automatic messages.
5. **Return path:** If remaining free allowance is missing, SKU consumption is unexpected,
   or quota effects are unclear, set the browser referrer back to exactly
   `https://riparim-google-paused.invalid/*`. Preserve low method quotas and
   exclusion of Places (New) from the browser key. GetPlace and photos
   are not automatically re-enabled at the start of a new month.
   Check application-owned profiles/ratings and direct Maps/directions links first;
   a potentially paid provider probe is not proof of shutdown.
   Document changes/readbacks separately from actual live and billing evidence.
   Publish only as a verified main release according to
   `docs/releases.md`.

Google failures must not interrupt application-owned profiles/ratings or confirmed Maps/directions links.
The app shows loading errors instead of zero Google ratings and
starts no automatic retry loop in the same area; new navigation or
explicit refresh may request again. Isolated DE/SQ/EN fixtures
check `enabled:false`, HTTP 429, identity/widget timeouts without
real provider connections. API research requires substantiated remaining free
allowance; otherwise use the official Maps UI or defer; contact no businesses.
Only independently authored/substantiated business data, Place IDs,
and verification metadata remain permanently; no new general API content cache/bulk import for stars,
reviews, opening hours, or photos. Existing historical snapshots
remain unchanged and are not presented as live Google values.

## Primary documentation

- https://developers.google.com/maps/documentation/javascript/usage-and-billing
- https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/get-started
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/place-details
- https://developers.google.com/maps/documentation/javascript/reference/place
- https://developers.google.com/maps/documentation/javascript/reference/places-widget
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/custom-styling
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/place-photos
- https://developers.google.com/maps/billing-and-pricing/sku-details#places-ui-kit-query
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/policies

## Completion of the remaining eight drafts

After completion on October 5, the inventory contained **129 public passenger-car workshops with unambiguous Google assignments and no drafts**. The eight old drafts are removed at the user's request; `data/workshop-final-removals.json` protects their identifiers against reimport. The independently substantiated northern location Reno Muçiqi & Bllaca receives its own identifier, confirmed Place ID `ChIJhxuISoKdVBMRjzIZ8rKjdEc`, and no transferred customer links from the old southern profile. The Place ID was directly verified to resolve to the same business point with a mismatched fallback search. Positive passenger-car service evidence comes from the business's own posts and an official maintenance contract. All eight outcomes and the independent location source are in `data/catalogue-final-2026-10-05.json`. After comparison with its specific truck/bus and motorcycle presentation, Burak's generic passenger-car text is insufficient to substantiate an unambiguous passenger-car workshop scope. The five numerically substantiated historical Google star values remain unchanged; no new Google content was stored and the server daily limit was not bypassed.

## Expansion on October 10, 2026

Twenty-nine new automotive service businesses, including ten with detailing or paint restoration, expand the catalogue to 158 public profiles. All new Place IDs were resolved directly through the official Maps JavaScript SDK with Place Details and individually compared against independently published contact details, name, and location. There were 45 browser text-search queries and 29 direct ID checks, but no server-side Places queries. Google ratings, addresses, phone numbers, and coordinates were not copied into Git or D1. New profiles receive no Google snapshot. Verification proves business assignment, not ownership verification status at Google. Independently authored evidence and outcomes are recorded in `data/import-2026-10-10.json`.

## First daily run on October 11, 2026

Auto Enzo Detailing and Shine Detailing Studio add two detailing businesses in Prishtina
with unambiguous Google assignments to the versioned catalogue:
**158 → 160 profiles, still no drafts**. The businesses' own posts in
a traceable independent mirror substantiate contacts, streets, and
specific services; Shine also has independent contact evidence.
Both active Google entries were checked in the required Gmail profile through
the official Place ID finder and then directly by ID with
a deliberately mismatched fallback search. Phone and street match.
No Google business data or new ratings are copied,
and no ownership confirmation is claimed.

Seventeen independently researched candidates and six existing duplicates were
reviewed. Only two candidates currently meet all publication conditions;
missing unambiguous IDs, missing Google phone contact, and an unresolved
location change cause deferral. The dry run adds exactly two
IDs and updates no existing profile. DE/SQ/EN content and central
translation hashes are verified. The manifest
`data/import-2026-10-11-daily.json` distinguishes the verified source import
from live publication still requiring confirmation. The original 158
profiles were fully compared against D1 without profile-field differences
and securely backed up before import.

## Required research procedure for the daily routine

Since the user's decision on October 12, 2026, the daily
import automation always checks new identities exclusively through the public
Google Maps UI. It uses no owned API keys,
Places/Maps API or SDK calls, embeds, or API finders.
The complete procedure and deferral conditions are documented in
[daily-workshop-import.md](daily-workshop-import.md). Existing production
widgets and their provider quotas are unaffected by this research rule.

## Daily import on October 13, 2026

Auto servis ‘BERATI’ BMW and Auto Servis & Diagnoz "OPEL" in Malishevë
expand the verified source inventory from 162 to 164 profiles. Public
directories substantiate contact details, street, and vehicle maintenance/repair;
active Maps entries were compared exclusively through the public UI
and verified directly by Place ID. Brands, consultation languages,
WhatsApp, and additional services are not inferred from names.
The import changes no previous profiles. Sources, deferrals, and
PR/release/live acceptance status are documented in the
[import manifest](../data/import-2026-10-13-daily.json).
