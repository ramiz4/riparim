# Workshop data

Use [workshops.json](../../data/workshops.json) as the canonical catalogue. Preserve
IDs, approval, sources and check dates. Export newer approved operator changes
before editing it. Past counts/decisions live in [history](../archive/catalogue-history.md).

## Add or update profiles

```sh
npm run catalog:merge -- /absolute/path/to/import.json
npm run catalog:merge -- /absolute/path/to/import.json --write
npm run catalog:check
```

Use complete records in a `workshops` array; dry-run first. `--write` is atomic.
The [validator](../../lib/workshop-source.ts) rejects invalid/future evidence,
incomplete/retired records and duplicate IDs/Place IDs. Publication needs confirmed
Google identity; uncertain candidates stay deferred or draft.

Match Place ID, name/alias, international phone, town, address and location.
Shared phones alone do not merge branches. Keep [scope](../../data/workshop-scope.json)
and both [removal](../../data/workshop-removals.json)
[manifests](../../data/workshop-final-removals.json) effective. Infer no services,
brands, languages or WhatsApp from names/ratings. Follow [daily import](daily-import.md).

The [shared import factory](../../db/catalogue-import.ts) serves runtime/release
planning. Retryable imports preserve newer revisions, ownership, reviews and
drafts, delete no profiles and write completion last. Deployment applies the
reviewed plan after migrations and before upload.

## Ratings and Google identity

Riparim ratings use approved app reviews only. Google assignments retain confirmed
IDs/check dates and authored evidence. Historical snapshots keep provenance and
unknown values but affect no public rating/sort. Current stars/reviews/photos/hours
are not fetched/copied. Follow [Google identity](google-places.md) for research/storage.

## SQ/EN display content

[workshop-translations.json](../../data/workshop-translations.json) holds only
`specialty`, `description`, ordered `serviceDetails`, `phoneNote` and ordered
`sourceTitles`. Canonical names, addresses, services, contacts, URLs and user text
remain original. Update these overlays after adopting current approved changes.

Compute revisions with [`workshopTranslationSourceHash`](../../lib/workshop-translations.ts);
preserve exact source text/order and review positional meaning. `catalog:check`
requires complete SQ/EN coverage and matching hashes for published profiles.
Changed live sources fall back to originals with a localized notice; overlays
never replace fields used for authorized edits.

## Contacts and multiple emails

[workshop-contacts.json](../../data/workshop-contacts.json) preserves older evidence;
[workshop-emails.json](../../data/workshop-emails.json) has version 2 per-address
sources/check dates and unsuccessful checks. Listing proves no delivery/consent/
ownership. Infer no addresses from domains; imports send no email. Outreach stays separate.

[`workshop-emails.ts`](../../lib/workshop-emails.ts) permits ten trimmed addresses,
at most 254 characters each, with case-insensitive duplicate checks.
`editorial_emails = null` uses active/unverified research. Editorial lists always
win, including empty lists. Entries have `address`, `active`, `verified`; changes
reset verification. Owner edits need approval; admin edits check permissions/revision.
Verification is manual business confirmation, not delivery testing.

Writes use `emailEntries`; public `emails` is not a write instruction. Editors
retain disabled entries and omit unchanged lists. The public response exposes
active `emails`/`emailContacts` only, without sources or inactive entries.
Imports preserve editorial choices, newer evidence and profile revisions.

```sh
npm run emails:import
npm run emails:import -- --output /protected/path/query.json
npm run emails:import -- --local-db /isolated/copy.sqlite --write
npm run emails:import -- --release vX.Y.Z --write --revision <preview-hash>
```

Use the preview's complete-manifest revision. Atomic writes check every assignment,
including empty lists; identical revisions are no-ops. Migrations `0023`/`0024`
add researched/editorial storage without rewriting old contact columns. Production
requires a verified main release and protected backup with isolated recovery.

## Opening hours

[`opening-hours.ts`](../../lib/opening-hours.ts) defines Monday-first weeks:
unknown, closed, appointment, or up to three ordered nonoverlapping intervals per
day. Use `HH:MM`; only an end may be `24:00`. Split overnight hours across days.
Up to 60 unique dated exceptions replace the whole day. Owner approval checks
ownership, moderation and revision together; its server date accompanies public
hours. Current open status uses `Europe/Belgrade`, half-open intervals and DST.

Migration `0020` adds owner hours without backfill. Old drafts preserve hours;
explicit `null` removes them. Catalogue imports do not overwrite owner hours.
The separately authorized [hours manifest](../../data/opening-hours-import.json)
uses migration `0022`. Owner hours take precedence; approved removal permanently
blocks imported fallback. Imported hours expose no provenance or invented
confirmation date and do not determine current open status.

```sh
npm run hours:import
npm run hours:import -- --csv FILE --prepare data/opening-hours-import.json
npm run hours:import -- --local-db /isolated/copy.sqlite --write
npm run hours:import -- --release vX.Y.Z --write
```

Prepare and apply separately; `--output FILE` exports the parameterized query.
Atomic writes check every ID/name/town/address/phone/publication against the
unchanged release manifest; mismatch aborts. Back up/recover affected tables first.
Repeats preserve removals and owner hours. Daily catalogue research imports no hours.

## Owners and premium partners

Manual ownership approval assigns only an existing public profile, granting no
admin/publication rights. Changes use separate drafts/revision checks; private
evidence/account IDs stay outside Git. Adopt Google reassignment and approval
together, preserving public identity while a draft is pending.

Premium slots use migration `0019` and authorized administration after external
payment confirmation. Only published profiles qualify; imports preserve status.
The landing shows at most three shuffled partners as advertising, or ordinary
published suggestions if none qualify. Neither implies quality; imagery is symbolic.
