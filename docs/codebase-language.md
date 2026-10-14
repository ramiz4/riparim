# Codebase language

English is the engineering language for first-party source names and identifiers,
comments, documentation, test descriptions, technical diagnostics, and internal
research/import commentary. This policy applies to the complete tracked tree,
including examples, fixtures, configuration and data manifests.

## Presentation and external contracts

The product remains multilingual: German (`de`), Albanian (`sq`) and English
(`en`), with German as the existing default. Keep translated messages in typed
`lib/i18n/` catalogs and explicit email templates. Keys and surrounding code use
English. Move display copy out of control flow; reuse the existing message/code
contracts rather than classifying human-readable text.

`lib/i18n/legacy-messages.ts` holds compatible German API response text. It is an
explicit compatibility resource, separate from client display catalogs. Existing
error/message codes and HTTP status remain authoritative. Clients continue to
select localized messages from those codes.

Localized public routes, historical query keys, section hashes, persisted
service/evidence/sentinel values, deletion confirmation and provider callback URLs
are external contracts. English source page identities are mapped to those URLs
centrally in `lib/i18n/locale.ts`. The public `/auth/bestaetigen` callback is served
through the English `/auth/confirm` implementation without redirecting sensitive
callback parameters. Existing cookies, issued links and safe-return checks remain
compatible. Decode legacy query properties into English internal names at the
boundary.

`scripts/lib/backup-monitor-messages.mjs` separates the existing German operator-mail
presentation from notification state and delivery logic. `canonical-values.ts` gives
English semantic names to unchanged stored values; `german-source-patterns.ts`
contains adapters for original German catalogue text.

Original business/place names, addresses, user and provider content, source URLs,
verbatim source titles and quoted evidence retain their language and bytes. German
catalogue display fields and their SQ/EN overlays remain presentation data. German
source-matching expressions and CSV headers are explicit adapters for original
input, not English prose. In documentation, put preserved UI/source labels and
wire values in inline code or quotation marks so the distinction is clear.

## Internal data commentary

Translate author-controlled notes, reasons, methods, limitations and research
summaries in catalogue/import manifests. Preserve factual source text, IDs,
coordinates, timestamps, source and permission/approval status. A language change
must not imply a new verification or a live import.

Check source hashes and import revisions before changing metadata. Display-field
hashes must continue to match the exact originals used by translation overlays.
Use existing hash helpers and explain revision changes. Applied migrations,
generated snapshots/lockfiles, binding declarations, upstream/vendor files and
existing Git history retain their original bytes.

The metadata-only translation in issue #186 preserved all 177 workshop display
records and their exact translation-source hashes. It changed the email manifest
revision from `942d4e7113607f94cb35eae061b14c10c63338579f79a84ad6ee1eb65b32831b`
to `97ac321669d891e17ba2ab7d6f7f3d84953e0a2ea19ad4fcf8afc72d161005d1`, and the
opening-hours revision from `7d2dc6ba11a47b96c67b64c0daf50933f2c08136f4030f5b23483ec457646e1a`
to `d86a8ad27e20b9da92e07140431d54b843c1960eefd24b07c65066941d76dec2` through the
existing revision helpers. No live import or factual re-verification occurred.

Original opening-hours CSV metadata (source/sourceName/researchStatus/originalWeek/
earlierPlan) and excluded-record reasons remain verbatim, including their validator
contracts. Persisted Google snapshot source labels and historical approved-source
titles also remain original provenance/display evidence. English research reasons
are separate from the compatible German API scope explanations in
`lib/i18n/legacy-scope-messages.ts`.

## Review and regression check

Run `npm run language:check`. The same check runs in the core test suite. It rejects
known German physical source directory names and reports a bounded vocabulary of
German engineering prose in Markdown, comments, technical diagnostics and internal
JSON commentary. Localized catalogs, quoted labels, original display fields and
immutable/vendor artifacts have explicit boundaries. Unicode is valid everywhere.

The check is deliberately a regression check, not proof that every sentence is
English. Review new and changed prose manually, including headings, code-example
comments, placeholders and test descriptions. Classify remaining non-English text
by its responsibility and record any new exception here; avoid broad directory
exemptions for first-party engineering prose. Check changed Markdown anchors,
relative links and source references. Keep meaning, historical evidence and
recorded limitations intact when translating documents.
