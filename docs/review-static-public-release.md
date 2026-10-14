# Independent review of the static public release

**Current completion status on 2026-10-11:** The four specific findings documented
historically below are corrected. Final code review found no further concrete
errors. Targeted import/health checks and catalogue checking with 160 records
passed. Final build, complete CI and actual main-release/live acceptance remain
outstanding; this statement does not confirm publication.

Status: 2026-10-10. Reviewed baseline: `2d593346c2337f827801835787bd4f4424da5ccc`;
uncommitted diff, including new files, in task worktree
`codex/daily-workshop-import`. The review changed only this report.

## Findings

### P1: One admin change disables all public snapshots

[`servePublicRelease`](../lib/public-release-routing.ts#L16) compares the entire
published live ID/revision list with the release source on every profile request.
If an admin changes or hides one profile, every other unchanged profile also
returns `null` and is subsequently rendered by the
[SSR handler](../build/cloudflare-worker.ts#L16). The catalogue needs an inventory
check; however, this unnecessarily also sends unchanged individual profiles
completely onto the known problematic path.

The independent probe bundled the routing module with two release profiles and
changed only the first profile's live revision. Requesting the second unchanged
profile actually returned:

```json
{ "untouchedProfileStaticResponse": null, "assetFetches": 0 }
```

The [setup documentation](daily-workshop-import.md#preflight-and-operation-without-additional-cost)
already records confirmed `exceededCpu`/1102 during public SSR on Workers Free.
A normal admin change can therefore reverse the availability improvement for
the entire inventory. Concrete recurrence of 1102 after this change was not
measured live in this independent review.

For individual profiles, check at least the requested ID's revision and
publication and continue serving unaffected snapshots. Provide a freshness
path verified under the Free limit for actually changed profiles and catalogue;
simply falling back to the demonstrably too-expensive SSR reader does not ensure
intended free availability.

### P2: Dynamic profile pages no longer adopt new review props

[`WorkshopProfile`](../app/[locale]/workshop/[id]/profile.tsx#L35) now copies
`initialReviews` and `initialReviewError` once into React state. Rendering uses
this state even with `publicSnapshot=false`. Unlike `workshop`, `directory` and
`display`, the dynamic path does not use updated props. The existing
[`onSubmitted` callback](../app/[locale]/workshop/[id]/profile.tsx#L73) still uses
`router.refresh()` for this path.

Independent React/JSDOM probe: render the same mounted dynamic profile component
first with `reviews=[]`, then with a newly approved review in props.
Actual result:

```json
{ "updatedReviewPresent": false, "emptyReviewMessagePresent": true }
```

Reviews and errors from the initial render thus remain visible despite new server
data. Only the snapshot path should use asynchronously loaded review states;
dynamic profiles must still immediately adopt updated server props.
Verify this transition as a regression.

## Evidence still required before activation

- A release with new canonical profiles initially differs from old live D1
  revisions. The static guard falls back to the dynamic reader before
  [`ensureInitialCatalog`](../db/directory.ts#L23). The first complete import
  validates the entire catalogue and writes multiple batches. Its actual CPU
  usage on Workers Free must be checked in addition to the warm snapshot path.
  Without this measurement, a successful local renderer is no proof for daily
  live imports.
- The new [Worker integration test](../tests/public-release-worker.test.mjs#L12)
  uses global `invoke_user_worker_ahead_of_assets: true`, while production uses
  [selective patterns](../wrangler.jsonc#L8). Actual production configuration,
  including `html_handling: none`, GET/HEAD, internal asset paths and RSC, must
  be checked separately. My additional Miniflare probe with selective patterns
  produced no result within the bounded wait and was terminated; this is neither
  successful router evidence nor a confirmed router error.
- The [live preflight](../scripts/daily-workshop-import.mjs#L39) checks locale,
  complete HTML and H1, but not the actually served profile ID. For new-profile
  acceptance, also compare `data-workshop-id` against the requested ID and
  release-commit/snapshot headers.

## Investigated security and release contracts

The [renderer](../scripts/render-public-release.mjs#L11) uses isolated D1/R2
bindings and blocks outbound provider access. It renders only published canonical
IDs in DE/SQ/EN. The internal render override is a local binding variable,
not a bypass activated by HTTP headers. The reviewed Wrangler source contains
no additional production `PUBLIC_RELEASE_RENDER` value.
The [session route](../app/api/session/route.ts#L4) uses existing server-side
user/admin checks and the [`no-store` JSON contract](../lib/http.ts#L1).
The existing review route reads only approved visits of published workshops.
No specific new disclosure of private visit evidence was found.

Removed runtime schema validation for immutable sources is complemented by
existing [CI catalogue checks](../.github/workflows/ci.yml#L45); actual initial
imports retain complete validation and revisions. Live translations are still
checked against [`workshopTranslationSourceHash`](../lib/workshop-display.server.ts#L14).
The [release packager](../scripts/package-release.mjs#L40) archives the complete
`dist` tree, including HTML files; its SHA-256 remains covered by existing release
provenance. Main/PR/CI/squash rules were not replaced by this diff.

## Primary sources and review limitations

Alongside linked repository sources above, user requirements,
[AGENTS.md](../AGENTS.md), [CONTRIBUTING.md](../CONTRIBUTING.md),
[workshop data](workshop-data.md), [Google Places](google-places.md) and
[releases](releases.md) were read.

[Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
and [bindings](https://developers.cloudflare.com/workers/static-assets/binding/)
confirm that Worker-first executes the fronting Worker, which can fetch assets
through the binding. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
remain relevant to an executed Worker. These primary sources do not replace
measurement of the concrete Riparim version in production.

Two targeted independent reproductions were performed in temporary directories
outside the repository. This review made no production data mutations, deployment,
browser access, email/contact delivery or new automation.
Complete CI and actual live acceptance remain the implementing agent's responsibility.
Only this report was changed as a repository file.

## Follow-up review on 2026-10-11

Original P1/P2 findings are resolved in the corrected state.
A renewed independent routing probe confirms the new decisions:

```json
{
  "assetPaths": [
    "/__public/de/werkstatt/untouched-profile.html",
    "/__public/de/werkstatt/first-profile-shell.html",
    "/__public/de/werkstaetten-shell.html"
  ]
}
```

The unchanged individual profile thus stays static even if another profile
changes. The changed profile and catalogue receive shells containing no data.
Hidden individual profiles immediately return HTTP404. Full profile snapshots
are additionally generated with only the relevant profile as the directory prop.
The repeated React/JSDOM probe with updated server review props returned
`{"updatedReviewPresent":true}`.

### New P1: Selective router test uses the wrong option type

The actually executed command `node tests/public-release-worker.test.mjs`
fails immediately with exit code 1:

```text
MiniflareCoreError [ERR_VALIDATION]
invoke_user_worker_ahead_of_assets: [...]
Expected boolean, received array
```

[`tests/public-release-worker.test.mjs`](../tests/public-release-worker.test.mjs#L12)
sets the `config.assets.run_worker_first` array there. The installed Miniflare
version expects a Boolean for this option. Installed Wrangler code
(`node_modules/wrangler/wrangler-dist/cli.js`, `getAssetsOptions`, lines
309013–309019) instead uses `routerConfig.static_routing = parseStaticRouting(...)`
for arrays; positive rules go to `user_worker`, negative ones without the leading
`!` to `asset_worker`. The test must represent actual configuration this way and
also adopt the production asset option `html_handling: "none"`.
This error currently blocks required build verification and prevents reliable
proof of the selective router.

### New P2: Live preflight counts error shells as publication success

[`checkLive`](../scripts/daily-workshop-import.mjs#L39) now accepts
`data-public-profile-id` in place of the actual profile identifier.
This proves only the requested shell ID. The shell also uses this marker in
its [error state](../components/public-workshop-shell.tsx#L21), when the live API
cannot load the profile; it still serves H1 and complete HTML.

An independent HTTP fixture probe served complete HTML with this marker and
`<h1>Profile unavailable</h1>` for all locales. The current checker actually
reported `{"unavailableShellHealthy":true}`. A shell response alone must therefore
not confirm a successfully published profile page with reachable content.
Either have preflight explicitly report shells as not yet accepted or, before
success, also check actual hydration, including visible profile ID and expected
content.

### External import and release contracts

The new [central statement factory](../db/catalogue-import.ts) is used by runtime
and [release plan](../scripts/catalogue-release-plan.mjs).
The [deployment import](../scripts/apply-catalogue-release.mjs) regenerates the
plan from the checked-out release commit and compares it completely before
writes. It queries the completion marker, runs batches of 50 and writes the
completion marker last. String parameters are written as SQL literals with
doubled apostrophes; no shell interpolation occurs. Existing revision predicates
protect newer admin text. The [deployment job](../scripts/deploy-cloudflare.mjs#L86)
executes this after migrations and before verified Worker upload.
The previously criticized initial live import thus needs no Worker CPU in the
regular release path.

`node tests/catalogue-release-plan.test.mjs` was run independently and passed:
partial abort without completion marker, resumption, completed retry without
writes, preservation of newer admin revisions, tampering/commit mismatch and
parameter escaping. Only the isolated SQLite test database was modified.
No additional Auth/privacy error was found in the new import path.
The production backup reported by the implementing agent was not opened or
repeated in this follow-up review.

This follow-up review replaces neither full CI nor browser/live acceptance of
the published version and API hydration. Only this report was changed as a
repository file.

## Final follow-up review on 2026-10-11

The router test now uses the actual array mapping intended by installed Wrangler,
`static_routing.user_worker`, and adopts `assetConfig.html_handling` from production
configuration. The earlier array-as-Boolean validation is thus corrected.
According to the implementing agent, the complete Worker integration test passed
against the previously generated 158-record build. After the new catalogue state,
the final 160-record build must run this test again; its success is not anticipated here.

Additionally, a small actual Miniflare asset-router probe with selective
Worker-first and `html_handling: none` was run independently.
The internal `/__public/` path was normalized and blocked by the Worker with
HTTP404 for encoded underscores, an encoded slash and a double slash too.
No direct asset access was permitted in these four variants.

Live preflight now requires actual `data-workshop-id` and the profile name
expected from the live API. The shell marker alone no longer counts as profile
proof. `node tests/daily-workshop-import.test.mjs` was rerun independently and
passed, including the new error-shell regression. The second follow-up finding
is therefore also closed.

`node tests/catalogue-release-plan.test.mjs` passed again with current source.
The central plan/runtime contract, complete prewrite comparison, retryability
with marker last and protection of newer admin revisions are preserved.
`npm run catalog:check` was run independently: 160 records, 160 published,
160 assigned Place IDs, no drafts or pending mappings. The only reported shared
phone belongs to the two already existing Eurogoma branches.

The two additions and SQ/EN overlays were read. Catalogue checking verifies
centrally generated translation hashes. Actually opened Google-independent
directories [Auto Enzo](https://www.autoyas.com/XK/Pristina/100237179537543/Auto-Enzo-Detailing)
and [Shine](https://www.autoyas.com/XK/Pristina/982725325082851/Shine-Detailing-Studio)
contain stored contact, street and service information in traceable business
posts. Auto Enzo also supports leather cleaning and PPF; Shine supports the
complete street number, glass/paint ceramic coatings and headlight protective
films. The additional Gjithebiznesi request returned HTTP429 in this independent
web check; the AutoYas source already contains corresponding information.
The implementing agent's new Google ID UI check was not repeated in the browser
here. Neither Google ownership, WhatsApp availability nor unsupported brands
are claimed; current Google business fields and new star ratings are not persisted.

The [dated import manifest](../data/import-2026-10-11-daily.json) correctly records
the import as `prepared_for_verified_release` and reports
`publishedCountConfirmed: 0`, `release.deployed: false` and outstanding live
acceptance. Update these states after confirmed release and actual follow-up
verification. Research coverage of smaller towns and the justified shortfall
below ten suitable candidates are documented.

No further concrete code/data errors were found in the examined state.
Release provenance, complete current CI, final build and live CPU/browser
checks for all supported locales remain regular completion checks owned by the
implementing agent. Again, only this report was changed as a repository file.
