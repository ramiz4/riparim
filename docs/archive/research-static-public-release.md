# Static public-release research: October 10, 2026

Historical source investigation of `vinext@1.0.0-beta.5`,
`@cloudflare/vite-plugin@1.37.1`, `wrangler@4.92.0`. It made no code/deployment
change and proved no production saving. Follow-up implementation evidence is in
[independent review](review-static-public-release.md) and
[catalogue history](catalogue-history.md#first-automation-acceptance).

The installed Vinext prerender API accepted `true` or `{routes:"*"}`, not selected
route arrays. CLI supported `--prerender-all`/`--prerender-concurrency`; the exported
internal runner existed. Normal builds wrote HTML/RSC to
`dist/server/prerendered-routes`, outside assets. Only `output:"export"` wrote to
`dist/client`, incompatible with the app's dynamic/private routes.

Actual Node import of the built Worker failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME`
for `cloudflare:workers`. Therefore native Node prerender was blocked; no full
prerender build was performed. Vite's experimental prerender Worker did not prove
an existing renderer for this pinned Vinext version.

The proposed minimal path built the actual Worker, rendered an explicit public
DE/SQ/EN/published-ID list in isolated Miniflare/workerd with canonical D1/R2 and
blocked providers, and packaged verified HTML/manifest under `dist/client`.
Reject redirects/error shells/incomplete streams/private data and verify locale,
identity, canonical metadata, source commit and content hashes before packaging.

Pure assets-first serving is free; a fronting Worker calling `ASSETS.fetch()` still
executes the Worker. Production needed `html_handling:"none"` for exact ownership
file behavior. Proposed redirects/header rules required actual router tests and
accounting for 2000 static/100 dynamic redirects and 100 header/Worker-first
patterns. This proposal is historical; later implementation used live status/
revision checks and shells, so it is not a current bypass recipe.

Anonymous release HTML must fetch protected session data after hydration and
public reviews through approved-only APIs. Shared assets contain no account/
evidence data. URL filters/private legacy targets, RSC, client navigation and
live admin changes required explicit compatibility tests. Build/render success
alone did not prove Worker CPU, freshness, privacy or daily live import acceptance.

Sources: [asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/),
[Vinext](https://github.com/cloudflare/vinext). Installed-version probes took
precedence over newer upstream documentation.
