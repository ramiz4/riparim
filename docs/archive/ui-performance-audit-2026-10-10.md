# UI/performance audit: October 10, 2026

Historical comparison against main `522c339`, branch `codex/ui-ux-performance`.
Production was unreachable/blocked in that environment. Measurements describe
the local built Worker and isolated components, not live Core Web Vitals.

Changes separated vehicle search from private review/evidence code, added image
variants, rendered picker selections before hydration, tightened the 390 px guest
header, focused newly added catalogue links and restored search-dialog trigger
focus after Escape.

## Measured assets

Deduplicated static entry dependencies from the Vite manifest, gzipped per file,
showed about 5% less JS on both homepage and catalogue. Framework remained included;
this did not measure document transfer or loading time.

| Image     | Original JPEG bytes |    WebP 640 px |   WebP 1024 px |    WebP 1536 px |
| --------- | ------------------: | -------------: | -------------: | --------------: |
| Hero      |              422856 | 38726 (−90.8%) | 82872 (−80.4%) | 153342 (−63.7%) |
| Diagnosis |              369208 | 29594 (−92.0%) | 51602 (−86.0%) |  83212 (−77.5%) |

At 390 px Chromium selected 640/DPR1 or 1024/DPR2 variants: combined bytes fell
from 792064 to 68320 or 134474. Sharp used `withoutEnlargement:true`, quality 78,
effort 6; originals remained and no runtime dependency was added.

## Verification and limits

- Built homepage/catalogue: DE/SQ/EN × light/dark × 320/390/768/1280 = 48
  combinations without overflow, empty selected labels or browser errors.
- Mobile search/empty/reset/Escape/pagination and server labels without JS passed.
- Actual synthetic signed-in header: 24 locale/theme/width cases, 44 px account
  target and keyboard/focus passed; this was not real login.
- [UI regression](../../tests/public-performance-ui.test.mjs),
  [asset regression](../../tests/public-assets.test.mjs), both Worker builds,
  catalogue, full tests, types, lint and packaging passed at handover.

No migration/provider/access/data change. Mobile LCP/INP/CLS, production provider
traffic and actual login remained unmeasured; no Lighthouse/PageSpeed score or
live speed improvement was claimed.
