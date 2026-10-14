# Codebase language

Write owned filenames, identifiers, comments, docs, tests, diagnostics, research
and manifest commentary in English throughout the tracked tree. Unicode is valid.
Keys and surrounding code stay English even when displayed text is translated.

## Preserve presentation and contracts

- UI/email copy supports DE/SQ/EN in typed `lib/i18n/` catalogs or explicit templates.
  Classify responses by codes/status, never human-readable text. Keep German legacy
  API messages in `legacy-messages.ts`/`legacy-scope-messages.ts`; clients use message codes.
- Preserve public URLs, queries/hashes, cookies, issued links, callback paths,
  stored service/evidence/sentinel values and deletion confirmations. Map English
  internals at their boundaries (`locale.ts`, `canonical-values.ts`). The proxy
  internally rewrites `/auth/bestaetigen` to `/auth/confirm` without redirecting tokens.
- Keep business names/addresses, source titles/URLs, quoted evidence, user/provider
  text and catalogue display fields byte for byte. Isolate original labels/wire values
  in code or quotes; keep source expressions/CSV headers in explicit adapters such
  as `german-source-patterns.ts`.
  German operator-mail copy stays in `scripts/lib/backup-monitor-messages.mjs`.
- Translate owned notes/reasons/methods/limits while preserving IDs, coordinates,
  timestamps, provenance and approval/permissions. Check source hashes/revisions;
  language edits are not new verification or live imports.
- Leave applied migrations, generated snapshots/locks/bindings, vendor files and
  Git history unchanged. Existing hours metadata, excluded-record reasons and
  persisted Google labels retain validator-compatible bytes.

## Check your change

Run `npm run language:check`; the core suite includes it. This bounded regression
check catches known German source names/prose, not every language error.
Manually review headings, examples, placeholders and tests; document justified
exceptions here without broad directory exemptions. Check Markdown links/anchors
and preserve historical evidence and its limits.
