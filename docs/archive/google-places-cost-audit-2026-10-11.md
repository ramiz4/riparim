# Google Places cost audit: October 11, 2026 (#96)

Historical values prove no current costs/allowance/configuration. Product pages
now make [zero Google queries](../data/google-places.md).

## Request comparison

SDK fixtures compared baseline `2d593346c2337f827801835787bd4f4424da5ccc` to #94/#95:

| Scenario                                          | Before                         | After at that stage                                     |
| ------------------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| Twelve first-visible catalogue cards              | 12 rating calls                | 12                                                      |
| Filter out/in same visible cards                  | 12 more                        | 0 more                                                  |
| Twelve added cards not yet visible / then visible | 0 / 12                         | 0 / 12                                                  |
| Old `sort=google`, 158 invisible matches          | 158                            | 0, normalized to name                                   |
| Profile Google sections invisible                 | Complete Enterprise details    | 0                                                       |
| Visible review section                            | Additional Standard widget     | One shared Standard widget                              |
| Visible photos                                    | From full details              | ID/photo/attribution metadata plus up to three previews |
| Thirty-minute open profile                        | Five-minute/transition refresh | No automatic calls; stale notice                        |
| Explicit visible refresh                          | Full profile refresh           | New widget, no photo metadata                           |

Fixtures excluded gallery/cache/widget internals and proved no production costs;
the app's 100/UTC-day identity limit did not cover widget/image quotas.

## Observed billing and price evidence

The signed-in `riparim-510521` dashboard for October 10 00:42:26–October 11
00:42:26 UTC showed Places New 143 calls, UI Kit 1, errors 0; Maps JS “—” did
not prove zero. Overview showed 2.73 CHF through October 11; SKU rows covered
October 1–10, assigned only to Riparim. Swiss billing/list prices were verified.

| SKU / ID                                | Observed quantity | Cost CHF | Account free monthly events | First paid CHF/1000 |
| --------------------------------------- | ----------------: | -------: | --------------------------: | ------------------: |
| Details Enterprise `2D9A-3DE0-3766`     |              1164 |     2.73 |                        1000 |              16.637 |
| UI Kit Query `0678-4F72-DA7C`           |                37 |        0 |                       10000 |             0.83185 |
| Text Search Pro `4FDA-34B1-A910`        |                 1 |        0 |                Not recorded |        Not recorded |
| Details IDs Only `5C36-E272-E88F`       |                 2 |        0 |    Zero-priced from event 0 |                   0 |
| Text Search IDs Only `635D-A9DD-C520`   |                 1 |        0 |    Zero-priced from event 0 |                   0 |
| Details Essentials `6E05-E1C3-8D85`     |               126 |        0 |                       10000 |             4.15925 |
| Photos `DCD1-FE97-8C71`                 |               144 |        0 |                        1000 |             5.82295 |
| Text Search Enterprise `E967-44BC-B44D` |               472 |        0 |                        1000 |            29.11475 |
| Dynamic Maps `FAF4-3B2D-51B2`           |                 1 |        0 |                       10000 |             5.82295 |

Enterprise exceeded its free tier; lag/zero-cost rows proved no after-saving or
remaining allowance. No budgets/Maps cap existed. The other-product cap draft
was cancelled; manual 50/80/100% thresholds were no alerts/cap. No paid services
or API counterchecks were enabled.

## Saved controls and return path

| Daily quota     |  Previous | Saved initially | Fresh UTC readback |
| --------------- | --------: | --------------: | ------------------ |
| GetPlace        |    125000 |               0 | 01:10:06           |
| SearchText      |     75000 |              20 | 01:10:06           |
| PhotoMedia      |    175000 |              20 | 01:10:06           |
| Standard UI Kit | Unlimited |              30 | 01:07:43           |
| Advanced UI Kit |      8000 |               0 | 01:07:43           |
| Sessions        | Unlimited |               0 | 01:07:43           |
| Map loads       | Unlimited |              30 | 01:07:21           |

IAM `placewidgets.googleapis.com` established UI Kit quotas; a generic Maps
redirect did not. GetPlace 0 also blocked free metadata/country details;
actual SDK `fetchFields` enforcement was not proven.

The privately matched served key lost six legacy/loopback referrers. Sole apex
was read back 01:09:12, replaced 01:11:45 by `https://riparim-google-paused.invalid/*`,
confirmed 01:12:07 with unchanged Maps JS/Places New/UI Kit APIs. This proved
configuration, not live shutdown/cost stop: propagation/open tabs/server key/billing
lag remained. Server key was Places New only. Restoration required fresh proof,
to `https://riparim.com/*` only.

Later October 11 readbacks: Standard 250/Advanced 100, Sessions/GetPlace 0;
browser APIs Maps JS/UI Kit only.
v1.12.7 enabled Standard, v1.12.9 approved Advanced after fresh allowance checks.
Later account: 4.34 CHF/1261 Enterprise events. Pro UI Kit `42AB-1FB3-B56A`:
5000 free, then 4.159249999 CHF/1000; missing rows proved no zero usage/current
state. Widgets through v1.26.2 authorized no later daily API research.

References: [Maps usage](https://developers.google.com/maps/documentation/javascript/usage-and-billing),
[Places usage](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing).
