# Google identity and Maps links

Workshop cards/profiles make **zero Google queries**. They show Riparim ratings and
application-owned hours. External Maps links use confirmed IDs; clicking opens Google.

## Confirm a workshop

1. Follow [daily research](daily-import.md): public Maps UI only, verified project
   browser profile, no API/SDK/finder or added costs.
2. Read the Place ID from the visible official Maps link. Open it again with a
   deliberately mismatched fallback search; compare independent business name,
   normalized phone, precise location and active status. Defer conflicts or missing evidence.
3. Store the ID, assignment/check date and independently authored evidence in
   [workshops.json](../../data/workshops.json). Duplicate Place IDs are rejected.
   Reconfirm after changes to name, phone, town, address or coordinates.

Direct `query_place_id`, `place_id` and `q=place_id:…` links identify an entry.
Search text, map centres and nearby businesses do not. A CID is not a Place ID;
confirm CID links against Google's returned identical CID. Reject foreign domains.
Search links require an independent phone or distinctive name plus precise location.
Shared contacts do not merge branches. Google assignment grants no ownership rights.

Every published workshop needs a confirmed identity, even without Google reviews.
The [public assignment route](../../app/api/google-places/[id]/route.ts) reads existing
assignments only; it neither searches Google nor changes assignments. An invalid or
changed identity returns no Place ID and keeps the Maps fallback.

## Existing API maintenance

This tool is separate from daily discovery. Preview makes no provider calls:

```sh
npm run catalog:google-match
```

An API run requires **explicit authorization**, confirmed remaining free allowance
and protected `GOOGLE_PLACES_SERVER_API_KEY`. The
[matching script](../../scripts/match-workshop-google-places.mjs) accepts
`--fetch --write --links --limit 100` (maximum 100 requests/run). The separate server
assignment path permits 100 search/details queries per UTC day. These limits do not
prove free allowance. Conflicts stay unassigned; never infer location from server egress.

## Rights, keys and costs

Keep independent sources/check dates. Place ID storage permission does not authorize
bulk storage of Google business content. Copy no current stars, reviews, photos or
hours. Historical substantiated snapshots keep provenance but affect no public rating
or sort. The separately authorized old hours import is in [workshop data](workshops.md).

Before retained integration changes, verify the actual release, billing event dates/lag,
shared allowance, quotas and key restrictions. Missing SKU rows, quotas and budget
notifications prove no complete monetary cap. Without confirmed free allowance, use
public Maps UI or defer. Enable no new paid services, plans or alerts.

Keys stay in protected runtime configuration, never Git/logs/hosting files. Server keys allow Places API (New) only. Browser keys
need separately authorized integration and demonstrated production HTTPS referrers;
local fixtures justify no production permissions. Do not invent fixed Cloudflare
egress restrictions. Preserve previous settings and reread persisted values after changes.
Missing keys disable retained routes; preserve app profiles, ratings and direct links.
Restore only after independent configuration/allowance checks and a verified release.

[Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)
and [usage](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
define provider terms. Past widgets, billing evidence and limitations live in the
[cost audit](../archive/google-places-cost-audit-2026-10-11.md).
