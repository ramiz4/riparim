# Central workshop data

`data/workshops.json` is the versioned source for workshop imports. It contains the current inventory: **177 published automotive service businesses, including vehicle detailing, and no drafts**. Each record's status is stored explicitly. The estimate of approximately 1,700 workshops comes from the user; it is not a researched total inventory or a claim of completeness.

The previous separate files for profiles and Google snapshots were incorporated into this source and removed. Names, contacts, sources, verification times, and stable Riparim identifiers are preserved. No placeholders are created for missing workshops.

## Rating sources

- Riparim ratings stay in the application-owned visit/review system. `rating` and `count` from Riparim aggregates do not belong in this profile source.
- `google.placeId` and `google.matchedAt` store the actual Google assignment. Assignments are verified through official map/business evidence or matching independent phone, name, and location evidence. `google.verification` preserves independently authored research metadata for the latest individually confirmed assignments. A published workshop needs a Place ID regardless of Google reviews.
- `google.snapshot` contains only previously independently substantiated snapshots, including original source and verification time. Only five star ratings have numeric evidence. Unknown stars or counts remain `null`.
- Current API stars and reviews are loaded live and stored neither in this file nor in Git, D1, or R2.

Google's standard terms do not allow a permanent Git database of copied Places business details and ratings. Place IDs are exempt from storage restrictions. A bulk import of Google content requires appropriate separate permission/licensing; an API key alone does not replace it. Without that permission, further business details are researched independently or adopted from a source explicitly licensed for this purpose.

## Validate, merge, and import

```sh
npm run catalog:check
npm run catalog:merge -- /absolute/path/to/import.json
npm run catalog:merge -- /absolute/path/to/import.json --write
```

An import file contains a `workshops` array with complete records in the same format. The first merge call only shows the planned comparison. `--write` updates the central file atomically. Invalid sources, duplicate IDs/Place IDs, future-dated information, or incomplete records are rejected.

Existing identifiers remain stable. A matching Place ID or exactly matching name, international phone number, town, and address prevents a second record. Shared phone numbers alone do not cause merging: the Eurogoma branches in Gjakova and Mitrovica stay separate. Older revisions and older Google snapshots do not replace newer information. Uncertain businesses are explicitly stored as `draft`. `data/workshop-scope.json` documents six entries excluded from scope and the Opel Rakovica business independently proven closed. The 27 rejected profiles, including Auto Electronics, are removed from the current catalogue. The eight remaining drafts were removed after final review at the user's request; the substantiated northern Reno location gets a new identifier. Existing Riparim ratings remain; services and brands are not invented from Google stars or a name.

After review and commit, the site is published as usual. Runtime import uses the central file's content hash as its completion marker. It adds new IDs and adopts only newer profile revisions; later admin changes, drafts, visits, and Riparim reviews remain protected. Import uses at most 95 SQL bindings per statement and 50 statements per batch, can be repeated after partial failure, and deletes no profiles.

Changes from the admin UI must be exported and adopted into this file before the next catalogue change. The existing admin UI still writes to the running database; it cannot create a Git commit. On conflict, the newer database revision remains until export updates the central file.

## Publicly substantiated contact details

`data/workshop-contacts.json` supplements existing profiles with email addresses and websites
researched on the businesses' own websites. The ten businesses compared on October 13, 2026 retain their existing identifiers,
phone numbers, towns, and approval status. The separate
`workshop_contact_details` table links every contact to its
profile through a foreign key and stores source URLs, verification date, and the matched name,
phone contact, and town. For JavaScript websites, the specific
publicly served source file is also retained in the evidence.

`email_verification = publicly_listed` means only that the business
publicly lists the address. It confirms neither delivery nor consent
nor business ownership. Outreach, replies, and follow-up dates stay in the
existing Google Sheet; this data import triggers no email delivery.
The original single-address column and website details remain for older
releases. Multiple addresses supplement them through the following contract.

`npm run catalog:check` checks contact format, sources, verification date, unique IDs,
and agreement with the published catalogue. Runtime import
includes the contact source in its completion marker and checks name, phone,
town, and publication again during the actual SQL write. Differing
live profiles are skipped; newer contact checks are preserved.
Contact details change no profile revisions, ratings, or ownership rights. The
additive Drizzle migration is applied through the ordinary verified main release;
the subsequent catalogue import adds the ten contact records.

## Multiple email addresses

`data/workshop-emails.json` uses version 2 of the contact contract and contains
one research row for each of the 172 existing workshop identifiers. The inventory rechecked in the internal browser on October 14, 2026 contains 113 addresses across
103 workshops, including nine with multiple addresses. Rechecking all 98 previously
empty lists adds 28 contacts across 27 additional workshops. Their own
websites, Facebook/Instagram, and public business directories including
ARBK Open were compared. ARBK Open is an independent directory, not a
government website. Rechecking all 75 open lists adds four further
contacts at Auto Ford, BMW balia, Pirqi, and SuperClean. Google phone searches,
an independent search, and signed-in Facebook/Instagram contact views
were compared. The subsequent targeted Google recheck of all 71 open
lists adds two more contacts: Lirimi through its exact phone contact and
TABAKU through business name and complete address. Both addresses
are publicly listed at Gjirafa; differing directory phones or
street descriptions are not adopted into profiles. New matching
Facebook/Instagram candidates and registry entries were checked directly.
Sixty-nine lists remain empty; Arlindi and the Bajrami email candidate
still lack a safe assignment. Nonmatching namesakes, template addresses, and historical
Facebook email aliases are not imported. Registry contacts may also be
representative/accounting mailboxes; this remains internally documented for each address.
Every address has its own
source URLs and verification date; unsuccessful checks and excluded
foreign results are documented. The ten existing addresses and their
evidence are preserved. No addresses are inferred from domains.

Migrations `0023` and `0024` add `workshop_email_addresses`, the nullable
`workshops.editorial_emails` column, and revision evidence in
`workshop_email_imports`. The first migration adopts the ten existing
contact rows with their evidence. Old columns are neither removed nor
rewritten. A database boundary allows at most ten researched addresses
per workshop. Catalogue import verifies actual business assignment and
adds only new or newer evidence; deployment planning remains free of
runtime decoders and their validator dependencies.

`editorial_emails = null` uses researched addresses. A stored
list permanently takes precedence, including an empty list. Its entries have
`address`, `active`, and `verified`. Disabled entries stay visible only
to the authorized owner and administration. Removed entries
are not publicly restored by later research imports.
Researched addresses are always unverified. Verification is manual
confirmation by authorized administration or an approved
owner change; it does not confirm technical delivery. Multiple addresses
can be verified simultaneously.

Owner changes use existing drafts and moderation;
admin changes use existing authorization and profile revisions.
The write contract uses `emailEntries` with status values; the public
string list `emails` is not interpreted as a write instruction during profile updates.
Both forms start with the currently effective list and also preserve
disabled editorial entries. Unchanged lists are omitted.
If the UI changes an address, it resets its previous verification.
System boundaries allow ten distinct addresses, at most
254 characters, trim outer whitespace, and check duplicates without regard
to case. Order and explicit verification/active values
are preserved.

The public API returns `emails: string[]` and associated active
`emailContacts: {address,verified}[]`. It exposes no sources, inactive
entries, or import metadata. The localized “Kontakt & Standort” (“Contact & location”) section contains individual encoded
`mailto:` links and each verification status. Without active addresses,
the email section is omitted. The scalar address aggregate changes neither
review counts nor stars; account emails and opening hours are not
edited. No email is sent.

```sh
npm run emails:import
npm run emails:import -- --output /protected/path/query.json
npm run emails:import -- --local-db /isolated/copy.sqlite --write
# Only with the published main release checked out:
npm run emails:import -- --release vX.Y.Z --write --revision <preview-hash>
```

The revision is the SHA-256 of the validated complete manifest. A
different supplied revision is rejected. Before every actual
write, import checks all workshop assignments, including
empty lists, and writes revision and addresses atomically. Identical revisions
change no existing data; newer evidence and every editorial
list remain protected. Before production migrations/imports, a
protected SQL backup with successful isolated recovery is required.
Publication takes place only through a reviewed PR, squash merge, and
the ordinary main release.

## Curated SQ/EN display content

`data/workshop-translations.json` contains only editorial SQ/EN
display content keyed by stable workshop identifier: `specialty`, `description`, ordered
`serviceDetails`, `phoneNote`, and ordered `sourceTitles`. All 129 versioned profiles
published at the start are covered. Names, addresses, contacts,
brands, consultation languages, source URLs, Google content, and user data remain
original. The file affects neither D1 import/seed marker nor identity hash,
approval status, or migrations.

The central `workshopTranslationSourceHash` contract in
`lib/workshop-translations.ts` computes SHA-256 over UTF-8 `JSON.stringify` of the
object in this fixed order: `specialty`, `description`, `serviceDetails`,
`phoneNote`, `sources`. Each source is exclusively
`{url,title}` in original order; array order, whitespace, and punctuation remain part
of the revision. Contacts, timestamps, source type, and other metadata
are excluded. Do not copy hash logic into maintenance scripts.

During catalogue maintenance, first adopt current approved admin/business changes into the
canonical source. Then review the five display fields for SQ and EN for accuracy
and update their arrays in the same original order. In particular,
directory provenance, unconfirmed reachability, and unknown services/brands
must be preserved. Compute the hash with the central contract;
do not merely replace the revision to reuse old translations.
`npm run catalog:check` rejects unknown/duplicate IDs, additional fields or
languages, stale hashes, incorrect array lengths, empty translations of nonempty
originals, and missing SQ/EN coverage of published versioned profiles.
Drafts create no coverage requirement. Each array text's assignment to its
original index is also reviewed editorially; hash checking cannot
detect semantically swapped translations.

The server-only adapter checks the hash again against actual
live fields and returns `displayById` separately from canonical `workshops`. A
changed or new live profile displays its current original with a localized
visible notice until the next verified catalogue/release update. Only an
original with a known, exactly matching German catalogue hash gets `lang=de`;
new operator/live free text is not universally marked as German.
A missing API locale preserves the German legacy response; explicit `de|sq|en`
returns the additional public display map. The authorized administration
response retains canonical data without an overlay. German original details
continue to determine service groups and search highlighting; their original indices
are preserved before normalization/deduplication. There is no automatic
translation of operator text, reviews, evidence, or private user data.

## Google assignments for the existing inventory

```sh
npm run catalog:google-match
# After configuring the server key in the secure runtime environment:
npm run catalog:google-match -- --fetch --write --links --limit 100
```

Without `--fetch`, no API requests are made. With `--fetch`, search by name and town runs only for existing published workshops, with at most 100 search/details queries per run. The key is read exclusively from `GOOGLE_PLACES_SERVER_API_KEY` and is never printed or stored. A result needs matching phone number, name, Kosovo, and location. Ambiguous results are not assigned. Authentication, quota, or Place ID conflicts are logged with the workshop identifier; API content and keys do not appear in the report. With `--write`, only successfully assigned Place IDs and independently recorded assignment times are adopted.

Live presentation also requires `GOOGLE_MAPS_BROWSER_API_KEY`; setup and key restrictions are documented in `docs/google-places.md`.

## Follow-up review of the 51 drafts on October 5, 2026

The remaining 51 profiles were reviewed again using current business pages, business posts, independent directories, and their specific locations. **Thirteen more existing profiles receive unambiguous confirmed Google identity:** Vedati, Auto-Diagnostika, Ford Jashanica, BEDA, Cufa, INOVATOR, Maloku, Mentori (formerly Fiat), Nero, BMW Prishtina, Kimi, Xhelali, and Gazi. Identifiers and earlier Riparim ratings are preserved. After this review step, the catalogue contained **125 published profiles and 38 drafts**.

For changed contacts or names, current business sources explicitly connect the earlier and current presence. INOVATOR's company history substantiates continuation as INOVATOR Automotive; Maloku's own website lists old and current contacts; Xhelali's independent business evidence links the previous contact to Auto Folje Xhelali. Kimi and Gazi lack Google phone contacts: here, a distinctive name, workshop photo, and actual profile-specific location marker in the independent Gjirafa directory substantiate the same business point within 300 metres. Map centres and other nearby workshops were not used as identity evidence. Additional precise profile coordinates for Cufa and Xhelali come exclusively from their self-published directions destinations.

Every new Place ID was checked directly at Google Maps with a deliberately mismatched fallback search. The direct ID check passed only if Google resolved the ID itself and selected exactly the previously verified business pairing. This prevents accidental confirmation through a mere name search. A CID alone remains insufficient. The application gains no additional logic for deriving IDs. **No further server-side Places queries** were performed; the shared daily limit remains unchanged. Google ratings and business data were not copied permanently.

All 51 outcomes are recorded in `data/catalogue-followup-2026-10-05.json`. **Thirty still needed unambiguously substantiated Google identity afterwards**, **branch continuity** remains unclear for Reno Center MUÇIQI, **Opel Rakovica is independently proven closed**, and **six scope exclusions** remain. Without proven continuity, the current northern Reno branch in Shkabaj/Obiliq is not transferred to the earlier southern profile in Graçanicë/Preoc. For Axha, Firi, and G & B, the nearby Google entry already belongs to the public BMW balia profile; proximity alone must cause neither new assignment nor overwriting. Historical or unassigned IDs for the closed business and other Reno branch appear only in the review report.

The first review with 34 approvals remains unchanged as a historical report. No schema change or new Drizzle migration is required. [Issue #53](https://github.com/ramiz4/riparim/issues/53) tracks cases that remain open.

## In-depth identity review of the 30 remaining cases

The 30 unresolved identities were investigated again through the businesses' own advertisements and posts, additional contacts on workshop signs, primary OSM data, and profile-specific location markers. **Three more existing profiles are confirmed:** Sfishta Auto Home (formerly Prishtina Auto Home), Auto Elektro Servis Niki, and Auto Pjesë & Servis Fatosi. The catalogue then contains **128 published profiles and 35 drafts**; all 163 identifiers remain.

Sfishta Auto Home's own service advertisement continues the previous contact. Official contract evidence names Auto Home and N.T.SH. Sfishta together in Bardhosh and confirms the Google entry's additional business contact. This substantiates operational continuity without claiming a legal merger. Niki's own advertisements and current business posts connect the unchanged contact, passenger-car electrical work/diagnosis, and Avdullah Presheva No. 82 to the combined Enesi Moto business point. The passenger-car workshop name is preserved; transport advertising alone is not evidence of repair. Fatosi's own advertisements link the previous contact to the Google contact of the car wash. Its own job advertisement and precise independent workshop marker confirm the same combined location; directory description and repair photos substantiate passenger-car services.

Google verification used the browser profile specified by the user. Every Place ID was verified to resolve to exactly the same entry with a deliberately mismatched fallback search. There were no additional server-side Places queries, no adoption of Google ratings, and no relaxation of the publication gate. New public profile information comes from independent business sources; Google coordinates were not stored.

`data/catalogue-identity-2026-10-05.json` documents all 30 outcomes and additional research procedures. **Twenty-seven identities remain unresolved.** The other eight drafts at this stage remain unchanged: one Reno branch conflict, the Opel business proven closed, and six scope exclusions. Earlier reports with 34 and 13 approvals remain unchanged; tests compare all three consecutive reviews.

## The 27 drafts rejected by the user

At the user's explicit request, exactly the 27 most recently unresolved identities are removed. `data/workshop-removals.json` records only removed identifiers, the instruction, and the inventory change: **163 → 136 profiles**, still **128 public**, **35 → 8 drafts**. Historical review reports remain unchanged; their earlier inventory counts are not current catalogue counts. The unmerged source-review PR #72 was discarded.

Before production removal, catalogue tables are securely backed up and recovery is checked. The atomic deletion operation requires all 27 unchanged, unpublished profiles without Google assignments and without linked visits, ownership rights, ownership requests, or change drafts. A conflict suppresses the entire removal. Customer tables and private evidence are neither written nor deleted.

Removal markers in `catalog_state` are preserved. New migration `0013_prevent_retired_workshop_reimport.sql` prevents older seeders from reinserting the profiles or their Google metadata. Fresh installations receive the same markers; the import validator and administration reject removed identifiers. Deletion is performed separately and in a controlled manner after the verified release. Later restoration requires an explicit instruction and must account for the manifest and markers; a code rollback does not restore data.

## Inventory review on October 5, 2026

All 85 open drafts were compared against the current production inventory. Seventy-seven lacked a stored Place ID; the eight already assigned drafts were six scope exclusions and two deferred location conflicts. No duplicate Place IDs were found. The 422 publication gate for missing unambiguous identity is intentional; it was not weakened.

Thirty-two drafts received a new Google assignment unambiguously confirmed against an independently substantiated phone number, distinctive name, and town. Readable independent directories, business advertisements, and OpenStreetMap where applicable substantiate passenger-car services. Two more drafts could be published after resolving outdated directory addresses: Autodiagnoza's own contact page lists Zona Industriale No. 98 and Plus Code M42G+74; a business post substantiates ACC/ADAS calibration on a passenger car. BMW Service Ferizaj's own business profile lists Brahim Ademi and an explicitly published directions destination. Both current locations are at most 300 metres from their unchanged retained Google entry. Coordinates come from independent business sources; map-view centres were not adopted.

The **34 approvals are published live**. The public inventory afterwards contained **112 profiles and 51 drafts**, including 21 public profiles with precise coordinates. All 112 published profiles have a unique Place ID. Identifiers, ownership rights, private evidence, and Riparim ratings were preserved. Before data changes, a protected backup of affected catalogue tables was created and its recoverability checked in an isolated SQLite database. Live adoption checked profile revisions and Place ID conflicts; the public API inventory was then compared against the central source.

**Afterwards, 45 drafts needed a confirmed Place ID; six remained excluded from scope.** Current phone, address, and a substantiated Google CID link were prepared for Vedati. Auto-Diagnostika's address and service scope were corrected to fault diagnosis only based on its business advertisement; no repairs are substantiated there. Both stayed drafts in this first review step pending Place ID resolution. Opel Rakovica is marked closed in the current independent directory. Server-side Google queries reached the shared daily limit of 100; the limit was neither increased nor bypassed. Independently authored review outcomes and the status of each of the original 85 drafts are in `data/catalogue-review-2026-10-05.json`; [Issue #53](https://github.com/ramiz4/riparim/issues/53) remains for open assignments.

Google responses were processed only temporarily for identity comparison. Only Place IDs and independently authored verification metadata are stored permanently; no new Google stars, reviews, opening hours, or Google business coordinates were adopted into Git or D1. No schema change or new Drizzle migration is required.

## Inventory review on October 4, 2026

All 92 previous drafts were reviewed for this publication. Nine could be approved through independent contact/passenger-car service sources and individually confirmed Google identity; 77 need further evidence, and six remain excluded from scope. Auto Regllazha TABAKU, Auto Service Bardhi, BMW-Visari, Autoservis Agimi, Auto Rally 90, BLEDI, XONI, Ylli Performance, and Ali Mercedesi were published. Each existing identifier is retained. BMW-Visari's current contact is also independently substantiated as a second phone number.

For 13 already published profiles, newly substantiated Plus Code addresses were converted offline into coordinates with the official Open Location Code algorithm. Each stored Google identity was confirmed against the independently substantiated location. Nineteen published profiles therefore have precise coordinates; these are not town centres and do not come from a Google API export.

The previously missing search origin for Skenderaj comes from GeoNames locality record [785642](https://sws.geonames.org/785642/about.rdf), not the municipality record. Distance sorting and radius search therefore also work when this town is selected. The origin remains a town centre; workshop coordinates stay separate.

Autodiagnoza Kosove and BMW Service Ferizaj, however, show a distance greater than 300 metres between their independently substantiated address and the current location of their stored Google identity. Both remain drafts pending independent clarification. Their identifiers, historical Google assignments, and ratings are not deleted. `data/workshop-scope.json` prevents accidental republication.

The review yields **78 published profiles and 85 drafts**. `data/catalogue-review-2026-10-04.json` documents every reviewed draft, independently authored identity checks, sources, and deferred conflicts. It contains no copied Google business content. No explicit reliable evidence was available for consultation languages currently offered; language fields stay empty. Previously confirmed service WhatsApp contacts were checked again; sales-only contacts and map-view centres were not adopted. Global Automotive's contact source now points to its current business page `/kontakti/`.

## Larger-scale research

A single Text Search query currently returns at most 60 results across up to three pages. Even multiple queries do not form a complete national list. Once access and data rights are established, research must cover all relevant municipalities and terms, process subsequent pages, further subdivide exhausted search areas, and document actual coverage. `car_repair` and `tire_shop` are suitable starting categories; car dealers and car washes require actual workshop evidence. Every import goes first into the JSON source, then into the site after review.

Official documentation, checked on October 3, 2026:

- https://developers.google.com/maps/documentation/places/web-service/policies
- https://cloud.google.com/maps-platform/terms
- https://developers.google.com/maps/documentation/places/web-service/text-search

## Verified business owners

Business owners request access to an existing public profile with private justification and optional HTTPS evidence links. Manual confirmation at `/verwaltung/betriebe` assigns exactly one account; it publishes no profile and grants no admin rights. Contact details, services, and description go through separate change drafts for approval. Adoption preserves identifier, sources, verification date, and approval status. Identity fields such as name and location remain reserved for administration; changed phone numbers pass through existing strict Google assignment again.

Identity checking of a draft stores no provisional Place ID over the public assignment. Approval and new assignment are adopted together if profile revision, confirmed owner, and moderation permission remain valid. An intervening admin change prevents adoption of old drafts. Approved business changes remain protected against older imports by their newer profile timestamp and must be adopted into the central source like admin changes during the next export. Private ownership evidence and account identifiers do not belong in the JSON catalogue source.

## Completion of the remaining eight drafts

The user approved the completion recommendation: remove six entries unsuitable for scope or substantiated as closed, replace the outdated southern Reno location with a separately substantiated northern location, and publish Isuzu/Burak only with specific passenger-car service evidence. Final research could not match Burak's generic English passenger-car text with a sufficiently specific passenger-car workshop scope at the assigned Prizren business point. Current company description and concrete service presentation substantiate truck/bus parts sales and motorcycle service. This draft and the old southern Reno profile are therefore also removed: **eight drafts removed, one new profile published, 136 → 129 profiles, 128 → 129 public, 8 → 0 drafts**.

`data/catalogue-final-2026-10-05.json` preserves the eight review outcomes and positive evidence for **Reno Muçiqi & Bllaca in Obiliq/Shkabaj**. An official maintenance contract from April 2026 and the business's own posts substantiate contact, northern location, and passenger-car maintenance. New identifier `reno-muciqi-bllaca-obiliq` and individually verified Place ID identify only this business point; customer links from the southern profile are not transferred. Precise workshop coordinates come from independently published location code M4H8+RCV, decoded offline as 8GJ3M4H8+RCV. Obiliq is added as a selectable town; its search origin comes from GeoNames locality record [787534](https://sws.geonames.org/787534/about.rdf), CC BY 4.0, and is not a workshop marker. There were no additional server-side Places requests and no adoption of new Google ratings.

`data/workshop-final-removals.json` adds exactly these eight identifiers to the previous 27 removal markers. The first removal and every historical review report remain unchanged. Existing generic triggers from migration 0013 also protect these identifiers against old seeders; **no new schema change or migration** is needed. Separate atomic live deletion after the verified release requires all eight unchanged drafts without visits, ownership requests, ownership rights, or change drafts. For the six already assigned drafts, the stored Place ID must exactly match the individually verified assignment; a new, changed, or missing assignment suppresses the entire operation. Private tables are neither written nor deleted. A protected catalogue backup and its recovery are checked beforehand.

## Expansion by 29 businesses on October 10, 2026

At the user's request, all new businesses unambiguously substantiated in this research are included beyond the originally requested 20: nineteen workshop/automotive glass/electronics businesses and ten with detailing or paint restoration. The 129 public live profiles were compared beforehand across all versioned profile fields; there were no differences. Existing profiles, identifiers, removal markers, and customer links are preserved. The reviewed merge adds 29 new identifiers without duplicates: **129 → 158 public, still no drafts**.

Business information comes from their own websites, self-published business posts, and independent directories. Each new business has a directly resolved Google Place ID with individually verified phone/name/location evidence. Detailers with identical names and differing contacts were not automatically adopted. For Opel Zh-Sh, the specific independent Plus Code confirms the correct branch despite a shared phone contact; for Sokoli, the same contact and precise Plus Code match despite a name suffix. Luxury Auto Detailing's current own posts replace a differing older directory location.

All 29 new profiles have curated SQ/EN display content and Google assignment metadata, but no copied Google business data, stars, or coordinates. Detailing is listed under the existing localized category “Karosserie & Lack” (“Bodywork & paint”) with explicit specialization; mechanical services are not invented for it. No migration is needed. The verified main release adopts entries through the existing runtime import. `data/import-2026-10-10.json` documents the 29 approvals and candidates not adopted.

## First daily run on October 11, 2026

Auto Enzo Detailing and Shine Detailing Studio add two detailing businesses in Prishtina
with unambiguous Google assignments to the versioned catalogue:
**158 → 160 profiles, still no drafts**. The businesses' own posts in
a traceable independent mirror substantiate contacts, streets, and
specific services; Shine also has independent contact evidence.
Both active Google entries were checked in the required Gmail profile through
the official Place ID finder and then directly by ID with
a deliberately mismatched fallback search. Phone and street match.
No Google business data or new ratings are copied,
and no ownership confirmation is claimed.

Seventeen independently researched candidates and six existing duplicates were
reviewed. Only two candidates currently meet all publication conditions;
missing unambiguous IDs, missing Google phone contact, and an unresolved
location change cause deferral. The dry run adds exactly two
IDs and updates no existing profile. DE/SQ/EN content and central
translation hashes are verified. The manifest
`data/import-2026-10-11-daily.json` distinguishes the verified source import
from live publication still requiring confirmation. The original 158
profiles were fully compared against D1 without profile-field differences
and securely backed up before import.

## Daily import on October 12, 2026

Auto Elektro Service AGRONI in Vushtrri and Auto Servis JONI in Sadovinë e
Jerlive/Viti expand the verified source inventory from 160 to 162 profiles.
Their own websites substantiate names, phone numbers, locations, and services.
Public Maps entries were compared individually against this information,
and their Place IDs directly verified with a deliberately mismatched fallback search.
There were no owned Google API/SDK calls and no ownership confirmation.

The dry run adds two IDs and updates no existing profiles.
German originals and SQ/EN overlays use the central translation hash.
The previous live inventory of 160 profiles and Place IDs was compared without differences;
four catalogue tables are securely backed up and restored in isolation.
BEXHI remains deferred without a Maps phone number; BELTI is deferred because of a
phone conflict. Further research outcomes and exact
PR/release/live acceptance status are documented in
[the day's manifest](../data/import-2026-10-12-daily.json). At the user's instruction,
the daily routine always uses the public Maps UI.

## Premium partner slots

Migration `0019_rare_molecule_man.sql` adds `workshop_premium` independently
of imported profile fields. Existing workshops do not become
premium partners; there is no data migration or payment integration.
Administration enables a slot after externally confirmed payment through
the localized “Premium-Partner” (“Premium partner”) action in the workshop list and removes it when the agreement ends.
Only server-authorized administration may change the status.
Activation requires a published profile in the write statement; public
partner data always excludes drafts. Profile imports do not overwrite
premium status; profile deletion removes it through a foreign key.

The landing page shuffles eligible partners on every load and shows at most
three, without duplicates. Random selections may repeat. Once
published active partners exist, selection includes only
those and is marked as advertising. Without active published
partners, three published businesses are shown as a random selection
at the user's explicit request; also at the user's request, without “Beispielplatzierung” (“Example placement”) text.
This selection enables no premium status. Neither selection nor
paid placement is a quality check.

The three card backgrounds are generated symbolic images; they do not come
from the displayed businesses. Cards label them accordingly.
A static dark gradient keeps name, service, and town
readable in both themes. Image motifs are assigned per card slot, not stored
as profile photos in workshop data. Prompts live in
`assets/partner-background-prompts.json`.

When deploying the verified main release, the additive migration is applied before
the new application. Production partners are not enabled automatically. Tests use only
isolated databases and fictional administration, without payments or live writes.

## Daily import on October 13, 2026

Auto servis ‘BERATI’ BMW and Auto Servis & Diagnoz "OPEL" in Malishevë
expand the verified source inventory from 162 to 164 profiles. Public
directories substantiate contact details, street, and vehicle maintenance/repair;
active Maps entries were compared exclusively through the public UI
and verified directly by Place ID. Brands, consultation languages,
WhatsApp, and additional services are not inferred from names.
The import changes no previous profiles. Sources, deferrals, and
PR/release/live acceptance status are documented in the
[import manifest](../data/import-2026-10-13-daily.json).

## Manual additional run on October 13, 2026

For a manual test of expanded research, the user authorized an exception
to the daily lock. Eight additional businesses in Vushtrri expand
the verified source inventory from 164 to 172 profiles without changing
existing profiles. Name, public phone, independently substantiated location, and active
Maps entry were individually checked; all Place IDs come from visible
public Maps links and were directly verified with a mismatched fallback search.

For ARDI, the publicly linked Facebook directions point substantiates the same
business point despite different street names. Daja lists only Vushtrri
with its postcode in its own profile; the catalogue adopts only this
town and notes that the exact street is not independently substantiated.
No Google streets, coordinates, ratings, or opening hours are copied.

German originals and SQ/EN overlays use the central translation contract.
Publicly substantiated business emails are recorded with source and verification time in
the additional run of the daily manifest. A missing email does not block
publication; deliverability and marketing consent are not
claimed. No messages were sent. PR, release, and live acceptance
are documented in [the existing daily manifest](../data/import-2026-10-13-daily.json)
or the local completion receipt.

## Application-owned opening hours

Verified owners edit opening hours together with their profile data. The
weekly schedule starts on Monday and contains seven days: unknown, closed,
by appointment, or up to three ordered time intervals. Times use
`HH:MM`; only the end may be `24:00`. For overnight opening,
intervals are entered on both days. Up to 60 distinct dated
exceptions completely replace the respective weekly schedule. Overlapping times,
invalid dates, and foreign metadata are rejected server-side.

Approvals use existing owner, account, moderation, and
revision checks atomically with the profile change. The public display names
the localized “Öffnungszeiten laut Werkstatt” (“Opening hours according to the workshop”) and server-side submission date of the
approved draft. Missing hours show a contact notice.
“Jetzt geöffnet” (“Open now”) uses Kosovo local time (`Europe/Belgrade`, including
daylight saving), exceptions, and half-open time intervals. Display updates
every 30 seconds and when tab visibility changes.

Migration `0020_married_magus.sql` adds nullable `opening_hours` and
`opening_hours_confirmed_at` to `workshops`. No backfill: existing profiles
start without their own hours. Old drafts without this field preserve existing
hours; an explicit `null` removes them. Catalogue imports and existing
admin profile upserts leave these separately maintained columns unchanged.
Google hours are not imported. Direct information from workshops can
be recorded through their verified owner functionality.

## Authorized opening-hours import on October 13, 2026

At the user's explicit request, `data/opening-hours-import.json` adds 171 weekly schedules
once from the researched CSV. Of those, 146 are researched;
25 are explicitly assumed defaults (Mon–Fri 08:00–18:00, Sat 08:00–16:00,
Sunday closed). The four conflicting or outdated
source schedules also receive this default. TITANS stays without an imported schedule
because it was reported permanently closed; its profile status is
unchanged. The assignment includes storage of researched
Maps hours for this specific list; it creates no general
Google bulk import or automatic refresh assignment.

Migration `0022_daily_dreadnoughts.sql` adds `workshop_opening_hours_imports` separately
from owner hours. Provenance, research notes, and replaced original schedules remain
internal. The public API returns only `importedOpeningHours`, no
import metadata. The UI prioritizes confirmed owner hours; otherwise it shows the
imported weekly schedule without a provenance notice or invented confirmation date.
Only confirmed owner hours receive a current open status. An
approved explicit removal blocks imported hours atomically, even before the
first import. Repeats and new import revisions do not lift this block.
A migration trigger also preserves removals of existing owner hours
during the transition from the previous app version.

Preview: `npm run hours:import`. Preparation from a complete CSV:
`npm run hours:import -- --csv FILE --prepare data/opening-hours-import.json`.
The published manifest state is applied to a local SQLite database with
`--local-db FILE --write` or in the verified release checkout with
`--release vX.Y.Z --write`. Before production changes, affected tables are
backed up and their recovery checked in isolation.
`--output FILE` exports the same parameterized import query for the
authenticated Cloudflare connection path. Executing it also requires
the verified main release and comparison against its unchanged manifest.

The single atomic import query checks all workshop IDs, names, towns, addresses,
phones, and approval status immediately when writing. A differing or
missing record aborts the entire query. The import revision prevents
rewriting the same data. Other profile fields, owner hours,
ratings, and private tables are not written.

## Daily import on October 14, 2026

Five new profiles in Istog, Klinë, and Rahovec expand the verified
source inventory from 172 to 177. Four business emails are independently substantiated;
MANA auto detailing's missing address stays explicitly documented.
DE/SQ/EN content, public Maps ID verification, and complete
live comparison are in [the daily manifest](../data/import-2026-10-14-daily.json).
The source import alone does not yet confirm live publication.

New businesses without researched opening hours appear in the hours manifest
with the source state `Nicht recherchiert – neuer Katalogeintrag` (“Not researched – new catalogue entry”). They receive no schedule;
171 existing schedules and the previous closure deferral are preserved.
Complete identity comparison and manifest revision also apply to these
deferrals. The daily import performs no production hours import.
