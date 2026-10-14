# Daily verified workshop import

The local automation “Riparim: daily verified workshop import” is authorized to research,
verify, import and publish through a reviewed main release. Contact no businesses and incur
no additional costs. Check the actual automation, connections and live release each run.
The requested time is 09:00 Europe/Berlin; the computer/app must run. Check local
scheduler timezone/DST rather than relying on a historical “ACTIVE” state.

## Start or resume

Acquire the shared lock from an isolated checkout or an initial read-only invocation
**before** synchronizing main or editing. Then follow [Git isolation](../../CONTRIBUTING.md).

```sh
node scripts/daily-workshop-import.mjs acquire <unique-chat-or-run-id>
node scripts/daily-workshop-import.mjs status
node scripts/daily-workshop-import.mjs health <profile-id> <profile-id>
```

Keep the lock token outside Git through PR/release/live acceptance. If acquisition
fails, inspect its owner chat/worktree/manifest/PR/release. Stop if the owner is active;
otherwise continue that task and its dated manifest. Never clear a lock by age or
automatically delete a damaged one. This lock covers cooperating worktrees on one
host; another host needs a shared lock.

Health must verify real profile identity/content, language and heading in DE/SQ/EN.
HTTP 200, loading shells and empty HTML are insufficient; check hydrated content when
needed. Error 1102 blocks publication. Compare actual version and Cloudflare outcomes
before activation and after deployment.

## Research and compare

1. Vary towns and services, including smaller towns, auto electrics, glass and actual
   detailing/polishing/ceramic protection. Aim for up to 30 new passenger-car businesses.
   Before accepting fewer than ten, broaden coverage, resolve pending identities and
   record the reason.
2. Use owned sources or traceable directories for name, contact, precise location,
   services and active status. Infer no brands, languages, WhatsApp or services.
3. Use **public Google Maps UI only** in `ramizloki82@googlemail.com`; verify the
   profile/window before browser actions. No API/key/SDK, embed, finder, scraping,
   proxy workaround or paid resources. Follow [identity verification](google-places.md).
   Store only the Place ID and authored evidence, not Google content.
4. Compare complete live public profiles, accessible drafts, assignments, approved
   operator changes and removal markers with canonical data and earlier manifests.
   Match Place ID, international phone, aliases, address and location; assess branches
   separately. Incomplete live comparison blocks mutation. Export catalogue/public
   fields only; private accounts, visits and evidence stay outside this comparison.

## Prepare and publish

Adopt newer approved changes first. Follow [workshop editing](workshops.md) for dry-run,
write, German originals, SQ/EN overlays and `catalog:check`. Preserve revisions,
ownership, approval and removals. No direct live inserts or invented placeholders.

Use one `data/import-YYYY-MM-DD-daily.json` through all continuations. Record coverage,
sources/check times, previous/live inventory, duplicates, deferrals, identity evidence,
request/quota use, dry-run, imported IDs, translations and final PR/release/live results.
Copy no current Google stars/reviews/photos/hours/business fields; change no quotas/widgets.

Complete [CI checks](../../.github/workflows/ci.yml), diff inspection, `git diff --check`
and independent review. Use `feat(catalogue)` for new imports. Follow the mandatory
[release procedure](../operations/releases.md), including verified squash merge and
release artifacts. Before deployment, back up affected catalogue tables privately and
verify isolated recovery; preserve the backup through handover without customer data.

After deployment, health-check every new profile in DE/SQ/EN and compare live inventory,
unique Place IDs and prior revisions. Report success only after version/outcome acceptance.
For zero candidates or failure, secure the manifest/reason without inventing a release.
Release the lock only after the outcome is known:

```sh
node scripts/daily-workshop-import.mjs release <matching-run-token>
```

Past setup and acceptance records live in [catalogue history](../archive/catalogue-history.md).
