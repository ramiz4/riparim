# Google Places cost audit: October 11, 2026

Issue #96 found Enterprise Details above its free allowance: the observed billing
rows showed 1,164 events and 2.73 CHF; a later account read showed 1,261 events
and 4.34 CHF. Missing or lagging rows did not prove zero usage or remaining allowance.
These historical prices and values establish no current cost or quota.

SDK fixtures reduced repeated/invisible requests and normalized Google sorting.
They excluded widget/image internals and proved no production savings. The app's
identity-query limit did not cover widget/image quotas. Product pages now make
[zero Google queries](../data/google-places.md).

Daily quotas were saved, then the browser key was paused with an invalid referrer;
readback confirmed configuration, not live enforcement or cost cessation.
Propagation, open tabs, the separate server key and billing lag remained limits.
No paid services or API counterchecks were enabled. Later Standard/Advanced widget
restoration followed fresh allowance checks and authorized no later API research.

Exact SKU/price tables, quota readbacks and key-return conditions are in the full
record below. New research uses [public Maps UI only](../data/daily-import.md).

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/google-places-cost-audit-2026-10-11.md).
