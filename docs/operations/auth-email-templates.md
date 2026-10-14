# Activate Auth email templates

Confirmation and recovery templates live in [`lib/auth/email-templates.ts`](../../lib/auth/email-templates.ts). Provider activation is separate from code deployment; a code rollback does not restore provider fields. Use this procedure for the existing hosted Supabase project. Other providers follow [Auth operations](auth-provider.md).

## Export and apply

Check the existing project's template access and SMTP setup first. [Provider restrictions](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) apply to newer Free projects using default SMTP; preserve the approved setup and stop if customization is unavailable.

1. Select a verified main release. Privately back up the provider's actual Site URL, redirect allowlist and both subject/body pairs. Preserve SMTP credentials separately.
2. Read the actual provider Site URL and release `SITE_ORIGIN`. Both must be the same canonical origin, without trailing slash or path. Export with those observed values into a new directory:

   ```sh
   npm run auth:email-templates -- \
     --site-origin https://riparim.com \
     --provider-site-url https://riparim.com \
     --output-dir /protected/path/new-auth-mail-export
   ```

   The [exporter](../../scripts/auth-email-templates.mjs) needs the project's Go version. It creates provider sources, six synthetic DE/SQ/EN previews and checksums, with no provider writes or real recipients. Origin mismatch stops export.

3. Restrict redirects to the production callback `https://riparim.com/auth/bestaetigen\?**`, plus a separately needed local callback origin. Preserve old links; avoid host/page wildcards or localized callback paths.
4. In the hosted project's [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates#editing-email-templates), update each subject/body pair together:

   | Provider template | Exported files                                       |
   | ----------------- | ---------------------------------------------------- |
   | Confirm sign up   | `confirmation.subject.txt`, `confirmation.body.html` |
   | Reset password    | `recovery.subject.txt`, `recovery.body.html`         |

   Read all four fields back and compare exact bytes. The Management API equivalents are `mailer_subjects_confirmation`, `mailer_templates_confirmation_content`, `mailer_subjects_recovery` and `mailer_templates_recovery_content`.

## Accept or restore

Use approved isolated test accounts for each locale. Check actual subject/body receipt, confirmation → separate login to the original target, recovery → reset → login, and old German links. Keep addresses, passwords and tokens private.

Short, old or unrecognized redirects deliberately use German fallback; that is not a successful SQ/EN check. Subject sources must fit the provider field, and previews do not prove hosted rendering or inbox delivery. `.preview.txt` files are readability previews, not a configured plain-text MIME part.

If acceptance fails, restore the backed-up four fields and leave email approval unconfirmed. Otherwise record the release, readback and receipt evidence separately from [customer QA](../development/customer-flow-qa.md). Automated export/template tests send no real messages.
