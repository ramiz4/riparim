# Codebase language

Use English for owned filenames, identifiers, comments, docs, test descriptions,
technical diagnostics and internal research/import commentary throughout the tracked
tree, including fixtures, examples, config and manifests. Unicode is valid.

## Preserve presentation and contracts

- UI and email copy remain German (`de`, default), Albanian (`sq`) and English
  (`en`). Keep display copy in typed `lib/i18n/` catalogs/explicit email templates;
  keys and surrounding code stay English. Classify responses by codes/status,
  never by human-readable text.
- `legacy-messages.ts` and `legacy-scope-messages.ts` preserve German API messages;
  localized client messages use existing error/message codes and HTTP statuses.
- Preserve public URLs, query keys, hashes, cookies, issued links, callback URLs,
  stored service/evidence/sentinel values and deletion confirmations. Map English
  internals at boundaries (`lib/i18n/locale.ts`, `canonical-values.ts`).
  `/auth/bestaetigen` uses `/auth/confirm` without redirecting sensitive parameters.
- Preserve original business names, addresses, source URLs/titles, quoted evidence,
  user/provider content and catalogue display fields byte for byte. Put preserved
  labels/wire values in code or quotes in docs. Source expressions and CSV headers
  are explicit input adapters (`german-source-patterns.ts`). German operator-mail
  copy lives in `scripts/lib/backup-monitor-messages.mjs`, separate from logic.
- Translate owned manifest notes/reasons/methods/limitations, preserving IDs,
  coordinates, timestamps, provenance and approval/permission status. Check source
  hashes/revisions with existing helpers; translation overlays must still match
  originals. A language edit is no new verification or live import.
- Keep applied migrations, generated snapshots/lockfiles/bindings, vendor files
  and existing Git history unchanged. Original opening-hours metadata, excluded
  record reasons and persisted Google source labels retain validator-compatible
  bytes; English research commentary remains separate.

## Check changes

```sh
npm run language:check
```

The core suite also runs this bounded regression check. It detects known German
physical source names and engineering prose; it is not a general language detector.
Manually review new headings, examples, placeholders and tests. Record justified
exceptions here; avoid broad first-party directory exemptions. Check Markdown
anchors/links and keep historical evidence and limitations intact.
