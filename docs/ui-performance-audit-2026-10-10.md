# UI, UX and performance audit on 2026-10-10

Homepage, workshop catalogue and shared navigation were checked against `main`
(`522c339`). Changes are on branch `codex/ui-ux-performance`.
The live domain was unreachable through web access and not permitted for outbound
HTTP access in the cloud environment. Results therefore refer to the local
production Worker and isolated component checks, not production measurements.

## Findings and changes

| Finding                                                                                         | Impact                                                                         | Change                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage and catalogue imported `app/journeys.tsx`.                                             | Review form, evidence and deletion dialog code were also browser dependencies. | Vehicle search as a separate component; public pages import it directly and receive only required language catalogues.                   |
| Both photos were always served as complete JPEG files.                                          | Mobile devices loaded unnecessarily large images.                              | WebP at 640, 1024 and 1536 pixels with `srcSet` and `sizes`; hero stays prioritized, second photo stays lazy and decodes asynchronously. |
| Selection values were missing from server HTML.                                                 | Search fields appeared empty before JavaScript.                                | `Picker` outputs the translated current selection during server rendering.                                                               |
| At a 390-pixel viewport, the guest header extended to about 391 pixels, beyond the screen edge. | Login and right page spacing were clipped.                                     | Login as a labeled 44-pixel icon on small displays; more compact logo and account menu up to 380 pixels.                                 |
| After “Mehr anzeigen” (show more), focus stayed on the button shifted downward.                 | Keyboard users skipped new results; the focus target disappeared at list end.  | Focus the first newly added profile link after rendering.                                                                                |
| Escape in vehicle search set focus to `BODY`.                                                   | Keyboard navigation lost its starting position.                                | Dialog remembers the actual trigger and restores its focus if still present.                                                             |

## Measured file sizes

Static JavaScript dependencies of the respective production entries were
recursively identified from `dist/client/.vite/manifest.json`, deduplicated and
compressed per file with Node's `gzipSync`. Homepage and catalogue thus each
need about **5% less JavaScript**. This compares browser dependencies;
it measures neither complete document responses nor actual transfer times.
Framework code remains included.

| Photo     | Previous JPEG |           WebP 640 px |          WebP 1024 px |           WebP 1536 px |
| --------- | ------------: | --------------------: | --------------------: | ---------------------: |
| Hero      | 422,856 bytes | 38,726 bytes (−90.8%) | 82,872 bytes (−80.4%) | 153,342 bytes (−63.7%) |
| Diagnosis | 369,208 bytes | 29,594 bytes (−92.0%) | 51,602 bytes (−86.0%) |  83,212 bytes (−77.5%) |

At 390 pixels, Chromium selected 640-pixel variants with DPR 1 and 1024-pixel
variants with DPR 2. Both photos together thus drop from 792,064 to 68,320 or
134,474 bytes. Original images remain. Variants were generated with Sharp:
`resize({width, withoutEnlargement:true})` and `webp({quality:78, effort:6})`.
There is no new runtime dependency.

## Verification

- Local production Worker: homepage and catalogue in DE/SQ/EN, light/dark,
  each at 320, 390, 768 and 1280 pixels. All 48 combinations without horizontal
  overflow, empty selection values or browser errors.
- Name search, empty state, reset, filter dialog with Escape and keyboard
  pagination in mobile catalogues; server-visible selection values also checked
  without JavaScript in all three languages.
- Actual header with synthetic Google account, project CSS and ThemeProvider:
  24 language/theme/width combinations, complete display, account target at least
  44 pixels, keyboard menu and focus after Escape.
  This fixture check is not actual login.
- `tests/public-performance-ui.test.mjs` protects selection values before
  hydration, the first new card and list end, and dialog focus in DE/SQ/EN.
- `tests/public-assets.test.mjs` checks both built public dependency graphs and
  served compact image variants. The native Worker test also checks new WebP
  files as technical resources without localization.

Handover verification includes `catalog:check`, full test suite, TypeScript,
lint, Cloudflare and Sites builds with browser and Worker checks, and packaging
both artifacts from clean committed source. There is no migration or change to
authentication, approval rights, provider configuration or production data.

## Outstanding production measurement

After the regular main release, check actual mobile LCP, INP and CLS values.
No Lighthouse/PageSpeed score or improvement in live loading time is claimed
here. Network and loading behavior with Google Places enabled in production,
and actual login flows, also remain outstanding; no runtime connections were
configured for those.
