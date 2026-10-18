# Workshop data

Edit [workshops.json](../../data/workshops.json), the canonical catalogue. First adopt
newer approved operator changes. Preserve IDs, approval, sources and check dates.

## Add or update workshops

1. Follow [daily research](daily-import.md) for live comparison, sources and duplicates.
   Confirm each published workshop's [Google identity](google-places.md). Defer uncertain
   candidates; never infer services, brands, languages or WhatsApp.
2. Prepare complete records in a `workshops` array. Preview, then write:

   ```sh
   npm run catalog:merge -- /absolute/path/to/import.json
   npm run catalog:merge -- /absolute/path/to/import.json --write
   ```

3. Update SQ/EN text in [translations](../../data/workshop-translations.json).
   Use [`workshopTranslationSourceHash`](../../lib/workshop-translations.ts) with the
   exact source text/order. Names, addresses, contacts and user text remain original.
4. Run `npm run catalog:check`, then follow [releases](../operations/releases.md).

The [validator](../../lib/workshop-source.ts) checks evidence, required fields and
duplicate IDs/Place IDs. Keep [scope](../../data/workshop-scope.json) and both
[removal](../../data/workshop-removals.json) [manifests](../../data/workshop-final-removals.json)
effective. Shared phones do not merge branches. Imports preserve ownership, drafts,
reviews and newer revisions; they do not delete profiles.

## Verified WhatsApp contacts

Before adding a workshop contact or changing its telephone number, follow the mandatory
[WhatsApp verification procedure](daily-import.md#whatsapp-verification-for-new-or-changed-workshop-contacts).
Every intended workshop-contact number needs an internal-browser WhatsApp Web lookup;
a telephone listing or generated link is not registration evidence. The daily manifest
records the exact international number, workshop/site IDs, UTC check time, method and
`registered`, `not_registered` or `unresolved` status.

Set `whatsapp` only to the exact positively checked, independently attributed workshop
number. Negative or unresolved new contacts leave it empty. Preserve existing confirmed
contacts and newer approved operator revisions; defer conflicts through the live
comparison. Shared numbers need one check with explicit site associations. Inspect the
existing button and target after the verified release, without opening chats, sending
messages, making calls, inviting anyone or creating contacts. Registration does not
establish ownership, responsiveness or acceptance of inquiries.

## Import researched contacts or hours

Preview first. Production writes need a verified main release, protected backup and
tested isolated recovery. Prepare manifests separately from applying them.

| Task           | Source                                                            | Preview                 | Apply to isolated SQLite                                            |
| -------------- | ----------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| Email contacts | [workshop-emails.json](../../data/workshop-emails.json)           | `npm run emails:import` | `npm run emails:import -- --local-db /isolated/copy.sqlite --write` |
| Opening hours  | [opening-hours-import.json](../../data/opening-hours-import.json) | `npm run hours:import`  | `npm run hours:import -- --local-db /isolated/copy.sqlite --write`  |

```sh
npm run emails:import -- --release vX.Y.Z --write --revision <preview-hash>
npm run hours:import -- --csv FILE --prepare data/opening-hours-import.json
npm run hours:import -- --release vX.Y.Z --write
```

Replace the tag with the verified release. Email writes require the preview's complete
manifest revision; hours verify the unchanged release manifest and every workshop.
`--output FILE` exports the parameterized query. Atomic writes reject mismatches.

Keep per-address sources/check dates and unsuccessful checks. Infer no addresses from
domains. Listed contacts prove no consent, delivery or ownership; imports send no mail.
Editorial choices, including empty/disabled lists, override research. Changed addresses
need fresh manual business confirmation; owner edits still need approval.

Owner hours override imports, and approved removal blocks imported fallback permanently.
Opening-hours manifests are included in the revision-bound release import before Worker
upload. Research the business's own published hours; when no usable schedule is available
and the user authorizes fallback hours, retain explicit `assumed` provenance. Defaults are
Monday–Friday 08:00–18:00, Saturday 08:00–16:00 and Sunday closed. They are never owner-confirmed
hours and do not determine current open status. For manual edits follow the
[hours contract](../../lib/opening-hours.ts): split overnight hours across days.
Imported hours have no invented confirmation date and do not determine current open status.

## Ownership and display

Riparim ratings use approved app reviews. Google snapshots retain provenance but are
not current ratings or sort inputs; copy no current stars, reviews, photos or hours.
Translation overlays need complete SQ/EN coverage and matching source hashes.

Ownership approval assigns an existing public workshop without admin/publication rights.
Edits remain separate drafts with revision checks; approve Google reassignment together.
Keep private account/evidence data outside Git. Premium status requires authorized
administration after external payment confirmation and survives imports. Only published
profiles qualify. Public premium
slots are advertising, not quality endorsements. Past decisions live in [history](../archive/catalogue-history.md).
