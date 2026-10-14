# UI/performance audit: October 10, 2026

The local built Worker and isolated components were compared against main
`522c339`; production was blocked/unreachable. Separating private review code from
search reduced deduplicated gzipped entry JS by about 5% on homepage/catalogue.
Responsive WebP images cut the two mobile images from 792,064 bytes to 68,320
at DPR1 or 134,474 at DPR2. Originals stayed; no runtime dependency was added.

Built public pages passed 48 locale/theme/width combinations, including keyboard,
mobile search and server-rendered labels. Synthetic signed-in headers passed 24
combinations with focus and 44 px account targets. Header spacing and search-dialog
focus were corrected. [UI regressions](../../tests/public-performance-ui.test.mjs),
[asset regressions](../../tests/public-assets.test.mjs), both Worker builds and
full checks passed at handover.

Asset bytes did not measure document transfer/loading time. Synthetic header
checks did not prove actual login. Production LCP/INP/CLS, provider traffic and
real login remained unmeasured; no Lighthouse score or live speed improvement
was claimed. No migration, provider, authorization or data change was made.

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/ui-performance-audit-2026-10-10.md).
