# Daily verified workshop import

The local automation “Riparim: daily verified workshop import” researches,
verifies, imports and publishes the catalogue through a reviewed main release.
These recurring steps are authorized. Contact no businesses and incur no
additional costs. Check the actual automation, schedule, connections and current
live release before each run; old setup/acceptance evidence is in
[catalogue history](../archive/catalogue-history.md).

## Start or resume

The requested time is 09:00 Europe/Berlin. This local automation requires the
computer and Codex app to run. If the interface stores only local time, check the
host timezone and DST; a historical “ACTIVE” state proves no future execution.
Follow [Contributing](../../CONTRIBUTING.md) for Git isolation.

Acquire the shared lock before synchronizing main or editing the catalogue,
from an existing isolated checkout or an initial read-only invocation:

```sh
node scripts/daily-workshop-import.mjs acquire <unique-chat-or-run-id>
node scripts/daily-workshop-import.mjs status
node scripts/daily-workshop-import.mjs health <profile-id> <profile-id>
```

The Git-common-directory lock covers cooperating worktrees on this host. Hold
its token outside Git until PR/release/live acceptance finishes. Concurrent
acquisition fails. Interrupted runs leave the lock intentionally; never clear it
by age. Check its owning chat/worktree/manifest/PR/release first. If the owner is
active, stop without mutation; otherwise continue its task and dated manifest.
Do not automatically delete a damaged lock. Another host needs a shared lock.

Health checks require a valid published inventory, complete HTML, matching
language, heading and actual profile identity in DE/SQ/EN. HTTP 200 or a loading
shell alone is insufficient. Error 1102 blocks publication. Compare active
version and Cloudflare outcomes before activation and after deployment.

## Research and identity

1. Vary municipalities and services, including smaller towns, auto electrics,
   glass and actual detailing/polishing/ceramic protection. Aim for up to 30 new
   substantiated passenger-car service businesses. Before accepting fewer than
   ten, broaden coverage and resolve pending identity checks; record the reason.
2. Substantiate name, contact, location, specific services and active business
   independently through owned sources or traceable directories. Do not infer
   brands, languages, WhatsApp or services from names/photos alone.
3. Use **only the public Google Maps UI** in the verified
   `ramizloki82@googlemail.com` browser profile. Check available profile/window
   information before browser actions. Use no owned API key, API/SDK, embed,
   finder, scraping or proxy workaround. No paid plans/subscriptions/resources.
4. Read the Place ID from the visible official Maps link and verify it directly
   again with a deliberately mismatched fallback search. Compare name,
   normalized phone, independent location and active status. Missing/conflicting
   evidence means deferral. Store only the ID and independently authored evidence;
   Google identity does not prove owner verification.

## Compare and prepare

Read the complete live public profiles, accessible drafts, Google assignments,
approved operator changes and removal markers through authorized access.
Compare against [workshops.json](../../data/workshops.json), earlier
research/import manifests, scope/removal records and historical names/contacts.
Match Place ID, international phone, alias, address and location; assess branches
separately. Fetch only catalogue/public fields. Incomplete live comparison blocks
mutation; private accounts, visits and evidence stay outside this export.

Adopt verified newer administration changes into the canonical source first.
Then use the [workshop guide](workshops.md): dry-run merge, reviewed write,
German originals plus SQ/EN overlays using `workshopTranslationSourceHash`,
and `npm run catalog:check`. Preserve revisions, ownership and approval status.
No direct live inserts and no invented placeholders.

Use `data/import-YYYY-MM-DD-daily.json` for the whole run and all continuations.
Record coverage, sources/check times, previous/live inventory, duplicates,
deferrals, identity evidence, request/quota use, dry run, imported IDs,
translation checks, PR/release and final live comparison. Copy no current Google
stars/reviews/photos/hours/business fields. Research does not change provider
quotas or production widgets.

## Publish and finish

Run required [CI checks](../../.github/workflows/ci.yml), inspect the full diff,
run `git diff --check` and obtain independent review. Use `feat(catalogue)` for
a new catalogue import so Semantic Release publishes it. Squash-merge only a
verified PR. Publish solely through the verified main release;
follow [release operations](../operations/releases.md) for artifacts/provenance.

Before deployment, securely back up affected catalogue tables and verify isolated
recovery. Preserve this backup through handover; export no private customer data
or secrets. The release imports its reviewed plan after migrations and before
Worker upload; repeatable batches write the completion marker last.

After deployment, check every new profile in DE/SQ/EN with health preflight;
compare live inventory, unique Place IDs and previous profile revisions.
If a page is a data-free shell, verify actual hydrated content separately.
Confirm active version/outcomes and report success only after acceptance.
For zero candidates or failure, secure the manifest and reason without inventing
an import/release. Release the lock with its matching token after outcome is known:

```sh
node scripts/daily-workshop-import.mjs release <matching-run-token>
```
