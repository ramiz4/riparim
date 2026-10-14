# Google identity and Maps links

Catalogue cards and workshop profiles make **zero Google queries**. They show
Riparim ratings and application-owned opening hours. Maps/directions are external
links derived from confirmed IDs; clicking opens Google. Historical widgets and
provider changes are [archived](../archive/google-places-cost-audit-2026-10-11.md)
and do not describe current product behavior.

## Confirm identity

A published workshop needs a confirmed Place ID even without Google reviews.
[workshops.json](../../data/workshops.json) stores stable Riparim ID, Place ID,
assignment date and independently authored verification evidence. Import and
administration validate this gate and reject duplicate Place IDs. Changes to
name, phone, town, address or coordinates require new confirmation.

For daily research follow [daily import](daily-import.md): public Google Maps UI
only, in the verified project browser profile; no API/SDK/finder and no added cost.
Verify the visible Place ID directly with a deliberately mismatched fallback
search, then compare independent business name/contact/location and active state.
Uncertain identities remain deferred. Assignment proves business identity, not
Google ownership or Riparim ownership rights.

Direct `query_place_id`, `place_id` and `q=place_id:…` links identify an entry.
Search text alone does not. Confirm CID links against Google's returned identical
CID; a CID is not a Place ID. Reject foreign domains. Search links need independent
phone or distinctive name plus precise location evidence; map centres and nearby
businesses are insufficient. Branches remain separate despite shared contacts.

The public [assignment route](../../app/api/google-places/[id]/route.ts) accepts
only an existing published ID. It reads its direct Maps identity or confirmed
stored assignment with a matching business-data hash; it performs no search,
updates no assignment and fetches no Google details. Without a valid unchanged
identity it returns `placeId:null`, preserving the existing Maps fallback.

## Separate maintenance tool

[`match-workshop-google-places.mjs`](../../scripts/match-workshop-google-places.mjs)
is an existing server-side identity tool for published profiles. It is outside
the daily research procedure. Preview makes no provider calls:

```sh
npm run catalog:google-match
```

An explicitly authorized API run requires confirmed remaining free allowance and
the protected `GOOGLE_PLACES_SERVER_API_KEY`; `--fetch --write --links --limit 100`
adopts verified assignments with a CLI limit of 100 requests per run. The separate
server assignment path shares 100 search/details queries per UTC day. Neither
limit proves remaining free allowance. Identity conflicts remain unassigned.
Keep existing `+381` contacts/RS region; `+383` uses XK. Known coordinates bias
three kilometres, otherwise Kosovo. Never infer location from server egress.

The [assignment store](../../db/google-places.ts) retains only IDs and authored
verification/retry metadata: seven-day unresolved retries, provider errors after
at least 15 minutes, short concurrency lease and yearly successful rechecks.
These maintenance rules do not cause public-page Google requests.

## Data rights and cost controls

Keep independently substantiated profile fields and source/check dates.
Place IDs are exempt from standard storage restrictions; an API key does not
grant permanent bulk storage rights for Google business data. No general content
cache/import for stars, reviews, photos or opening hours is authorized. Preserve
historical substantiated snapshots, without presenting them as current or using
them for sorting. The specifically authorized old hours import is documented in
[workshop data](workshops.md) and [history](../archive/catalogue-history.md).

Keys stay in protected runtime configuration, never Git/logs/hosting files.
Before changing retained provider integration, check the actual verified release,
billing event dates/lag, shared account allowance, quotas and key restrictions.
Daily/minute limits or budget notifications provide no complete monetary cap;
absence of a SKU row proves no zero usage. Without confirmed free allowance,
use public Maps UI or defer. Enable no new paid services/plans/alerts.

The browser key, if a separately authorized integration needs it, is restricted
to demonstrated production HTTPS referrers and its required APIs; local fixtures
do not justify production permissions. Server key is Places API (New) only;
do not invent fixed Cloudflare egress IP restrictions. Secure previous settings
before a change and read persisted values again after propagation.

Missing keys disable retained Google routes. Preserve application-owned profiles,
ratings and direct links during provider failure. Restore only after independent
allowance/configuration verification and a verified main release. Current zero-query
pages need no widget restoration. Historical key/quota readbacks and limitations
are in the [cost audit](../archive/google-places-cost-audit-2026-10-11.md).

References: [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies),
[Places usage](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing),
[Maps usage](https://developers.google.com/maps/documentation/javascript/usage-and-billing).
