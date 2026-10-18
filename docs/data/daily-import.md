# Daily verified workshop import

The local automation “Riparim: daily verified workshop import” is authorized to research,
verify, import and publish through a reviewed main release. Contact no businesses and incur
no additional costs. Check the actual automation, connections and live release each run.
The requested time remains 06:00 Europe/Zurich; the computer/app must run. Preserve
the existing automation recurrence, timezone, target and status when updating its
instructions. Check local scheduler timezone/DST rather than relying on a historical
“ACTIVE” state. Do not infer a new UTC schedule from a stored hour or an early heartbeat.

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
5. Research opening hours on the business's own public sources. If no usable schedule
   is attributable to the verified site, use the user-authorized standard fallback
   through the existing hours preparer and retain explicit `assumed` provenance.
   Never copy Google hours or invent owner confirmation. The release imports the
   checked hours manifest before uploading the Worker; existing owner plans and
   suppression markers remain authoritative.

## WhatsApp verification for new or changed workshop contacts

For every new workshop, check **every telephone number intended for workshop contact**.
Repeat the check when a telephone number changes. A sales-only or general corporate
number needs independent attribution to the actual workshop before it can be used.
Use [PR #217](https://github.com/ramiz4/riparim/pull/217),
[release v1.42.2](https://github.com/ramiz4/riparim/releases/tag/v1.42.2), the
[dated manifest](../../data/whatsapp-verification-2026-10-18.json) and
[research record](../archive/research-whatsapp-verification-2026-10-18.md) as method
references; their historical results are not fresh evidence for a new or changed number.

1. Use **only the internal Codex browser**. Visibly confirm
   `ramizloki82@googlemail.com` before browser actions and use its identified work
   window. Without that confirmation, do not navigate. Use the regular WhatsApp Web
   interface; no unofficial APIs, scrapers, bulk automation or paid checking services.
2. Use **New chat > Phone number**. Completely clear the input between checks and
   enter the exact full international number. Wait for the completed lookup:

   | Observed result                             | Recorded status  |
   | ------------------------------------------- | ---------------- |
   | Account result for the entered number       | `registered`     |
   | Completed lookup showing `No results found` | `not_registered` |
   | Missing login, delayed or ambiguous result  | `unresolved`     |

   A telephone listing or generated `wa.me` link alone proves nothing. Never classify
   an incomplete lookup as negative or claim availability from an unresolved result.

3. Record each check in the dated import manifest under `whatsappVerification` with
   `workshopIds`, exact `phone`, UTC `checkedAt`,
   `method: "whatsapp_web_phone_number_lookup"` and `status`. Check a shared number
   once per daily run and explicitly associate every applicable workshop/site ID.
   Keep unique-number and workshop counts separate. Old-number evidence cannot
   qualify a replacement number. Record concrete blockers and the next useful check.
   Retain no private chats, profile names, account data or screenshots containing them.
4. For a positive, attributable workshop number, set `whatsapp` to **that exact checked
   number**. The existing field holds one contact: prefer the evidenced workshop main
   contact when several numbers pass and document the selection; still check every
   intended number. Negative or unresolved new contacts keep an empty field and no
   button; that alone does not exclude an otherwise verified workshop. Preserve
   existing confirmed contacts and newer approved operator edits. Refresh live phone
   and revision comparisons before the write and merge; defer conflicting contact
   changes instead of automatically deleting confirmed data or overwriting newer edits.
5. Send no messages, make no calls, invitations or contact entries, and open no private
   chats. Registration is an observation at the recorded time, not proof of ownership,
   delivery, response time or acceptance of repair inquiries.
6. Use the existing guarded import, backup/isolated recovery, checks, independent
   review, squash merge and verified main-release deployment below. After deployment,
   compare the public API and every affected DE/SQ/EN profile: each positive contact
   has the correct existing WhatsApp button and exact target; negative or unresolved
   new contacts have none. Inspect the target without launching a WhatsApp chat or
   triggering outreach. Document discrepancies in the same run; missing acceptance
   is not completed publication.

The daily summary must report unique numbers checked, `registered` / `not_registered` /
`unresolved`, newly provided workshop WhatsApp contacts, concrete blockers and remaining
unresolved cases. Distinguish completed UI lookups from login/access-blocked attempts;
never present historical reference totals as today's checks. All existing import scope,
identity, email/hours, privacy, cost, lock and release requirements remain in force.

## Prepare and publish

Adopt newer approved changes first. Follow [workshop editing](workshops.md) for dry-run,
write, German originals, SQ/EN overlays and `catalog:check`. Preserve revisions,
ownership, approval and removals. No direct live inserts or invented placeholders.

Use one `data/import-YYYY-MM-DD-daily.json` through all continuations. Record coverage,
sources/check times, previous/live inventory, duplicates, deferrals, identity evidence,
request/quota use, dry-run, imported IDs, translations and final PR/release/live results.
Include the per-number WhatsApp checks, shared-site associations, status counts, newly
provided contacts, unresolved blockers and post-deployment button/target acceptance.
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
