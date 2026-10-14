# Daily verified workshop import

The local Codex automation **Riparim: täglicher geprüfter Werkstattimport**
(“Riparim: daily verified workshop import”) belongs to the project
`/Users/ramizloki/workspace/riparim` and uses
`gpt-6.1-sol` with `high` reasoning. Its assignment includes research, source and
Google identity verification, duplicate comparison, dry run, catalogue import,
translations, a reviewed PR, squash merge, release, and live acceptance.
The user has explicitly authorized these recurring steps;
new daily approvals are not required. Contacting businesses is prohibited.

## Schedule and runtime

The requested time is daily at **09:00 Europe/Berlin**. The current
automation interface stores a local time without a separate
timezone field. The desktop profile uses Europe/Zurich, whose current
UTC offsets and daylight-saving transitions match Europe/Berlin. The
schedule is therefore stored locally at 09:00. This is not a separately
stored Berlin timezone: if the desktop timezone changes, check the schedule
again before further activation. On 2026-10-11, the scheduled time
corresponds to 07:00 UTC. After successful live acceptance on
2026-10-11, the automation was locally confirmed as **ACTIVE**; the next scheduled time
was 2026-10-11 at 09:00 local, or 07:00 UTC. A paused automation has no
executable next run.

This is an executable local agent assignment, not a cloud cron. The computer
and Codex app must be running and able to access the repository and required
connections. Access through GitHub CLI, the Cloudflare connector, and the
browser profile `ramizloki82@googlemail.com` was verified during setup.
Browser actions are possible through the existing native UI; the
browser extension is currently connected only in the other profile. Secrets
live in the production Worker and are not exported to the automation.
Wrangler is not logged in locally. Remote D1 read access uses the
Cloudflare connector; GitHub Actions handles deployment.
Authentication and quotas can expire between runs and are checked again before every
run. A connection in this session does not prove
persistent access for a later scheduled run.

## Shared lock and continuation

Before synchronizing main and before any catalogue edits, run the following
from an isolated worktree:

```sh
node scripts/daily-workshop-import.mjs acquire <unique-chat-or-run-id>
node scripts/daily-workshop-import.mjs status
```

The lock lives in the shared Git directory and applies to all worktrees
of this repository on this host. Concurrent acquisition fails. The
returned token belongs to the run, is not a provider secret, and is used only
for controlled release. It stays outside Git in the local
lock file. Hold the lock until the PR, release, and live checks are complete.

```sh
node scripts/daily-workshop-import.mjs release <matching-run-token>
```

An interrupted run deliberately leaves the lock in place. There is no automatic
timeout and no release based only on its age. Check the owning chat,
worktree, dated manifest, open import PRs, and running release jobs.
If the owner is still running, end the new run without mutations. If it has
ended, continue the task in the existing worktree and manifest; release
the matching token only after the import/deployment outcome is established.
This prevents a second import after an unknown partial success.
Do not automatically delete a missing or damaged lock file.
The lock protects cooperating runs on this host; additional hosts
may start the same routine only after a shared lock has been established.

## Preflight and operation without additional cost

```sh
node scripts/daily-workshop-import.mjs health <profile-id> <profile-id>
```

Preflight reads the public live inventory and catalogue/profile pages
in DE/SQ/EN. HTTP errors, Error 1102, a missing heading, incorrect language,
and incomplete HTML responses block publication. HTTP 200
alone is insufficient because streaming can abort. Before activation and
after every release, also compare Cloudflare outcomes and the active version.
The check writes no production data and sends no messages.

The user requests **no additional costs**. New Google identities
are **always checked exclusively through the public Google Maps UI**
in the verified browser profile. Read the Place ID from the visible
official Maps link and immediately verify it again with a deliberately mismatched
fallback search; compare name, normalized phone number, location, and
active business status against independent sources. Missing
or conflicting evidence defers the candidate.

The routine uses no owned API keys, Places/Maps API or
SDK calls, embedded maps, or API finders. An unknown free
API quota remaining blocks those API paths, but not the public Maps check.
Do not change quotas, production widgets, or provider approvals for the import.
Provider terms still apply; no scraping or proxy workaround.
Create no paid plans, new API subscriptions, or paid resources.
Use existing Codex allowances. Only the Place ID
and independently authored verification metadata remain permanently; business data is substantiated independently of Google.

On 2026-10-10, the Cloudflare dashboard confirmed **Workers Free / 10 ms CPU per
request**. The public SSR application exceeds this
limit; version v1.11.1 also produces `exceededCpu` and HTTP 503/Error 1102.
The routine remained paused until confirmed live acceptance. The user
authorized the conversion to public HTML release artifacts without additional cost.
The implementation renders the catalogue and profiles in DE/SQ/EN exclusively in
a local workerd with an isolated D1 database from the canonical source.
Rendering uses no production access or provider requests.
A small Worker check of published IDs and profile revisions
precedes asset delivery: newer admin changes invalidate only the affected profile. It then
delivers a data-free shell and loads current public content through
the API. Hiding a profile immediately returns HTTP 404. For changes
to the overall inventory, the catalogue also uses a data-free shell;
unchanged profiles retain their complete static response. Login data and public
Riparim reviews load after hydration through private session or public
review APIs; RSC requests stay dynamic. Direct access to the
internal asset path is blocked. This status query counts toward existing
Workers Free allowances; no additional plan is activated.

Previously, the catalogue reader validated the entire
unchanged source before every fetch. It now skips this
check when a completion marker is present. Actual imports retain full validation,
revision tests, limits, and the idempotent completion marker. Release CI
continues to check the catalogue and every translation hash. Static
artifacts are also backed up in the existing immutable release archive.
The build additionally generates an import plan from the same central
statement factory as the runtime import. The deployment job compares this
plan exactly against the reviewed source commit and executes it externally through D1
after migrations but before Worker upload. Batches of 50 remain
repeatable; the completion marker comes last. New data therefore needs
no first CPU-intensive import request in the Free Worker. Before a
catalogue release, securely back up affected catalogue tables locally,
verify recovery in isolation, and preserve the backup until a safe
handover; export no private customer tables or secrets.

References: [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/),
[static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[local scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app).

## Research, comparison, and import

Vary municipalities and services; include smaller towns. The target is
up to 30 substantiated new passenger-car service businesses daily, including auto electrical work,
automotive glass, and actual detailing/polishing/ceramic protection. If fewer than
10 suitable businesses are found, import only those and document the reason.
Leads without contact, location, services, and an active unambiguous
Google assignment remain deferred.

Before mutating the catalogue, read current public profiles, accessible drafts,
Place assignments, public admin/business changes, and live
removal markers through authorized access. Fetch only catalogue tables
and public profile fields; export no private user/visit evidence.
Compare against `data/workshops.json`, every earlier import
and research manifest, and scope/removal files. Account for historical
profile names and contacts of removed IDs using existing history.
Compare Place ID, normalized international number, name/alias,
address, and location; assess branches separately. Uncertainty
means deferral. Stop if a complete live comparison is unavailable.

First adopt verified newer admin changes into the canonical source;
the runtime protects against older imports but does not replace this export.
Use existing tools for new complete records:

```sh
npm run catalog:merge -- /absolute/path/to/verified-import.json
npm run catalog:merge -- /absolute/path/to/verified-import.json --write
npm run catalog:check
```

Complete German originals and SQ/EN overlays. Compute translation hashes
only with `workshopTranslationSourceHash`. Preserve newer profiles,
ownership rights, moderation, and private tables. No direct
live inserts; the release repeatably adopts the verified canonical source.

`data/import-YYYY-MM-DD-daily.json` is the dated run manifest. A repeat
continues the same manifest. Record sources and verification time, municipality coverage,
candidates/duplicates/deferrals, independently authored Google identity evidence,
requests/quotas, previous inventory, dry run, import result, IDs, translation checks,
PR, release, and final live comparison there. Google identity
does not prove verified ownership. Store no copied current Google
business data, stars, reviews, opening hours, or photos.

## PR, release, and follow-up checks

All checks from `.github/workflows/ci.yml`, the full
diff, `git diff --check`, and independent review are required. PRs and
commits follow Conventional Commits. A new catalogue import uses
`feat(catalogue)` so Semantic Release produces a publication.
After successful current checks, merge only by squash into main.
Confirm the GitHub Release with all artifacts/provenance required
by `docs/releases.md` for the current format and a successful deployment job.
No feature-branch deployment or Sites publication.

After deployment, check every new profile in DE/SQ/EN with preflight;
compare live inventory, unique Place IDs, and previous profile revisions.
Report success only afterwards. For zero candidates or failures,
secure the manifest and specific reason; invent neither an import nor a release.

## Acceptance of the first controlled run

[PR #99](https://github.com/ramiz4/riparim/pull/99) was squash-merged after successful
CI and independent review.
[Release v1.12.0](https://github.com/ramiz4/riparim/releases/tag/v1.12.0)
from `54549c17df92aecde2d5a7562a7106913e5a8bf0` contains four confirmed
artifacts with matching commit and SHA-256 provenance.
The [release/deployment run](https://github.com/ramiz4/riparim/actions/runs/38093081018)
was entirely successful; Cloudflare confirms the new version for 100 percent
of traffic. Workers Free remains in place.

Two new businesses are published, bringing the live inventory to 160.
Two complete health runs confirmed the catalogue and both profiles in
DE/SQ/EN with HTTP 200, correct identity, and complete HTML without
Error 1102. The 19 public fields of all 158 previous profiles,
158 Google assignments, 129 stored rating rows, and 49 previous
catalogue states still match the protected backup.
Six researched existing duplicates were not imported again.
The remaining candidates stay deferred because of missing unambiguous identity,
missing phone comparison, or conflicting location.

The [import manifest](../data/import-2026-10-11-daily.json) contains sources,
deferrals, the active automation, release, and live acceptance. Observed
outcomes of the new Worker version during the acceptance interval were exclusively
`ok`; this is a time-limited observation. The connector
continues to deny billing/detailed-log endpoints with Error 10000. Aggregated
observability, read-only D1 comparison, and deployment access work.
