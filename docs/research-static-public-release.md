# Static public pages in a verified release

Status: 2026-10-10. Investigated versions: `vinext@1.0.0-beta.5`, `@cloudflare/vite-plugin@1.37.1`, `wrangler@4.92.0`. Result of an independent source/code investigation; no implementation or deployment evidence.

## Concrete result

Cloudflare Static Assets can serve public HTML files before the Worker; these asset requests and asset storage are free according to [Cloudflare billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). Invocations of the Worker script remain relevant to costs/quotas. A fronting Worker that then executes `ASSETS.fetch()` therefore does not achieve the same goal.

Vinext's native prerender API exists in the installed version. It alone is insufficient for Riparim: all three public pages are `force-dynamic`, read authentication and D1; native non-export prerender artifacts land outside the asset directory; the existing built Worker also fails on Node import of `cloudflare:workers`. The smallest reliable integration still uses the same verified Worker build, produces public anonymous HTML snapshots in an isolated local workerd/Miniflare run and includes only those results in `dist/client`. Private routes and APIs remain Worker routes.

## Actually verified installed APIs

`node_modules/vinext/dist/config/prerender.d.ts` and `.js` define:

```ts
vinext({ prerender: true });
vinext({ prerender: { routes: "*" } });
```

The CLI supports `vinext build --prerender-all` and `--prerender-concurrency`. Only `routes: "*"` is accepted, not an array of selected URLs. A short Node test successfully checked normalization of both valid configurations, rejection of a route array and the `vinext-config` selection reason. `import('vinext/internal/build/run-prerender')` actually returns a function. This internal API is exported in installed `package.json`; if used, it should remain bound to the existing pinned version.

`node_modules/vinext/dist/build/run-prerender.js` writes HTML and `.rsc` under `dist/server/prerendered-routes` in a normal Worker build, with `dist/server/vinext-prerender.json`. Only `output: "export"` writes directly into `dist/client` and treats dynamic SSR routes as export errors. The global export target would be unsuitable for this app. Native prerender configuration also requires statically generatable locale and profile parameters; unpublished, removed and excluded IDs must never appear there.

The native runner starts `vinext/server/prod-server` in Node. Direct import of existing `dist/server/index.js` was actually performed and returned:

```text
ERR_UNSUPPORTED_ESM_URL_SCHEME
Received protocol 'cloudflare:'
```

Built chunks for storage, Auth and notifications import `cloudflare:workers`. This concrete finding goes beyond the general compatibility comment in Vinext's type definition. A complete native prerender build was not performed; the import failure suffices as a proven prerequisite blocker.

`node_modules/@cloudflare/vite-plugin/dist/index.d.mts` contains `experimental.prerenderWorker` with auxiliary Worker configuration and `experimental.headersAndRedirectsDevModeSupport`. The built plugin creates a dedicated prerender environment. This does not establish an already existing Vinext renderer for Riparim. An additional experimental Worker is unnecessary for the initial minimal snapshot path. Local rewrite acceptance should use the generated Wrangler/Miniflare production build because Vite dev handles these files only with the experimental option.

Current [Vinext primary sources](https://github.com/cloudflare/vinext) now describe a newer tool/adapter division. Concrete integration statements were therefore based on the installed version rather than applying current README commands to beta.5 without verification. The [upstream skill](https://raw.githubusercontent.com/cloudflare/vinext/main/.agents/skills/migrate-to-vinext/SKILL.md) was read as context; this existing application needs no reinstallation or migration.

## Existing release path and minimal addition

`package.json` builds through `scripts/run-framework.mjs`. Native macOS invokes the Vinext CLI; managed Linux uses `scripts/build-verified.sh`. The Bash script invokes `vinext build` without passing additional CLI arguments. A shared post-build phase is therefore more reliable than local extra flags alone. The existing build subsequently runs navigation/asset tests and i18n Worker checks.

Minimal integration:

1. Build the existing Worker/client build unchanged in its provider isolation. Then run a clearly bounded snapshot phase before `release:package`.
2. Serve the built app locally with workerd/Miniflare and only isolated D1/R2 bindings. A dedicated local database receives existing migrations and the canonical published catalogue. No production access, real users, Supabase session or remote binding. Normal runtime import logic may transfer the catalogue there. Alternatively, a narrowly scoped local-only prerender env path can read the canonical public catalogue; introduce no bypass headers controllable by external HTTP clients for this.
3. Render an explicit URL list from supported locales and published catalogue IDs: public homepage, catalogue and profiles. The snapshot phase may accept only HTTP200 with expected HTML structure, correct locale/canonical metadata and complete catalogue. Auth/data errors, “unavailable”, redirects or truncated HTML streams must fail the build. Native HTML contains RSC hydration data generated by Vinext; custom-constructed HTML would replace this contract and require more work.
4. Store completed HTML files only under a controlled public asset prefix in `dist/client`. A manifest contains exact permitted source/target paths, catalogue hash, commit and HTML hashes. Store no private HTML pages, storage objects, drafts or runtime secrets in assets.
5. Reach clean existing URLs through asset routing. Production requires `assets.html_handling: "none"` so ownership-verification HTML retains its exact names. Do not globally change this policy to automatic HTML resolution. [Cloudflare `_redirects`](https://developers.cloudflare.com/workers/static-assets/redirects/) supports internal `200` proxy rules, for example `/de/werkstaetten /__public/de/werkstaetten.html 200`. Limits are 2,000 static and 100 dynamic rules, 2,100 total; with 30 new profiles daily, one rule per profile becomes too large in the medium term. A narrow profile wildcard per locale is a possible alternative, but unknown/removed IDs must still return actual 404 and receive no generic profile. Test this in the local asset router.
6. `dist/client/_headers` adds `X-Riparim-Release-Commit` for assets because the previous Worker stamp does not run during free asset serving. [Cloudflare header rules](https://developers.cloudflare.com/workers/static-assets/headers/) permit at most 100 rules; use appropriate prefix rules. File extensions determine MIME type; `Content-Type` must not accidentally produce a binary download. Prefer the existing revalidating cache contract; HTML is not permanently immutable.
7. Perform all snapshot/routing/client checks before packaging. `package-release.mjs` already archives the complete `dist` tree; HTML/manifest content is therefore covered by existing SHA-256 provenance. CI builds Cloudflare and Sites from the same commit, so the phase must clearly decide whether both targets receive the same public assets. Existing main/PR/CI/squash/Semantic Release and artifact deployment checks are preserved.

[Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) serves existing assets first by default and invokes the Worker for missing assets. `run_worker_first: true` or public patterns in that list would undermine the goal. The installed Vite implementation limits this list to 100 patterns. [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) confirms that with `none`, a clean URL does not automatically find its `.html` file; this is precisely why explicit asset rules are required.

## Authentication, freshness and navigation

The public page source currently supplies personalized props: `account`, `isAdmin`, `signedIn`. `components/site-header.tsx` uses them for account menu, logout, administration and verified locale changes. An anonymously generated HTML file must obtain actual session state after hydration through a server-verified private API contract without writing account data into the static release. Query results do not belong in a shared public cache. Authorization for actions remains server-side.

The profile page reads published Riparim reviews from D1. An empty local test database must not imply “keine Bewertungen” (no reviews) for a profile already reviewed live. Review data should load after hydration through existing `/api/reviews?workshop=…`, with honest loading/error states. `router.refresh()` after a review would target an HTML snapshot with an RSC request under asset-first routing; instead reload reviews specifically or perform complete browser navigation.

`components/locale-anchor.tsx` already uses native `<a>` navigation and is suitable for this. Other RSC/router push/refresh paths must be checked: the asset layer cannot distinguish HTML from RSC by the `RSC: 1` header. Client code requiring dynamic navigation should use either specific API refetching or complete document navigation. Another option would be a separate explicit RSC target, but that enlarges the diff.

Catalogue filters, `bewerten=1`, profile `suche` and old landing parameters (`besuche`, `einreichung`, `werkstatt`, `nachweis`) are currently server query logic. Static Assets serves the same snapshot for every query; existing meanings must be preserved client-side before/during hydration. `_redirects` cannot express conditional query/cookie rules. Account/evidence navigation in particular must not silently disappear.

New admin changes are still stored securely in live D1. A static release represents verified canonical state until the next release. Preserve live reconciliation before every catalogue import and documented export requirements. Client-side updates may display newer live fields, but an expensive `/api/workshops` call on every public page load would partially reintroduce the original CPU load. Load necessary supplementary data through small dedicated API queries where possible.

## Required checks

- Complete snapshot inventory for DE/SQ/EN, correct titles/canonical metadata, profiles with catalogue and translation hashes, 0 private or discarded IDs. Error/redirect/incomplete HTML fails the build.
- Local production asset router: public GET/HEAD URLs, query/hash navigation, known profiles, unknown/removed profiles, `.html` ownership verification, canonical and workers.dev hosts, correct MIME/release/cache headers. A simple artificial Worker error must not affect existing public assets; this verifies actual assets-first behavior.
- No user identity, email, session cookies, private visits or credentials in snapshots or manifest. Cookies must not alter public HTML bytes; private API/admin/Auth routes must still check sessions and permissions.
- Actual browser acceptance in the specified browser profile: hydration, themes, responsive keyboard operation, search filters from URL, locale switch, signed-in header/logout, review form and subsequent data refresh, JavaScript errors/RSC MIME errors.
- Release policy tests check expected header/rewrite artifacts as well as the asset directory and forbid global Worker-first, SPA fallback and unauthorized public snapshot routes. Finally, required CI checks, PR review and live verification of the actual main release; Worker logs/request counts should confirm public HTML requests no longer execute SSR.

Only API normalization/import probes and source/code checks described above were performed. There were no code changes, complete build or publication, and no cost/performance claim about an already changed production state.
