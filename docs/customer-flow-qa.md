# Customer flow: verification on October 4, 2026

## Verified live

- Test registration was performed through the published site. The delivery service confirmed delivery, and the user confirmed their email address.
- Confirmation and recovery templates in the existing Supabase project now use the server-side token-hash callback. The `weiter` parameter is preserved; login after confirmation therefore returns to the original workshop and review location.
- A real recovery email with the new template was delivered. The user confirmed a successful password change and return to login.
- Verified email delivery was then approved in protected site administration. The regular site endpoint `/api/auth/recovery` returned HTTP 200; that email was also delivered. Approval lives in the runtime database, not Git.

Test addresses, passwords, confirmation tokens, and sessions are not stored in this documentation. The existing SMTP project was retained. Templates follow the documented [Supabase token-hash procedure](https://supabase.com/docs/guides/auth/auth-email-templates); delivery uses [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Review flow in the local browser

The portable development server used only the local test identity and project-local SQLite/R2 storage. A review explicitly labeled as a test was submitted with a PNG test file. It initially appeared only under the person's own submissions and in review administration. An unauthenticated request for the private evidence was rejected with HTTP 401.

After local admin approval, text and four stars appeared in the workshop profile. Editing reused the existing evidence and returned the submission to the localized status “In Prüfung” (“Under review”); the public review disappeared. The entire local submission was then deleted. Personal and public lists were empty, the evidence returned HTTP 404, and local R2 object, multipart, and part tables each contained zero records. No fictional customer reviews were published in production.

## Automated checks

`npm test` checks routes with isolated provider, SQLite, and R2 fixtures. New coverage includes the complete email flow with preserved return destination, invalid tokens, provider errors, password changes with account-wide session revocation, and logout. Storage checks now also include failed deletion with retry, three pages of old evidence, and deletion during a delayed replacement upload. These tests send no real emails and change no production data.

Other publication checks are `npm run catalog:check`, `npx tsc --noEmit`, `npm run lint`, and the Sites Worker build. The catalogue test protects the nine new approvals, 13 confirmed coordinates, and two deferred location conflicts. The distance test accounts for the added GeoNames search origin for Skenderaj.

## Standalone personal reviews (Issue #61)

`/bewertungen`, `/sq/bewertungen`, and `/en/bewertungen` use the regular page structure with shared page width, heading, and a retry action on loading errors. Personal history has no modal frame; editing and deletion confirmation retain their existing dialogs. Old landing links redirect server-side to this page. Valid `einreichung` targets and language survive the existing login flow; invalid or ambiguous submission targets are discarded.

Observable test boundaries are the rendered React page and navigation, plus HTTP, authentication, and metadata contracts. `tests/my-reviews-page.test.mjs` checks direct visits, safe login return, legacy redirects, DE/SQ/EN metadata, and the loading notice before hydration. `tests/notification-link-ui.test.mjs` checks targeted submissions, returning to complete history and back to the targeted destination, and rejected foreign submissions. `tests/my-reviews-ui.test.mjs` covers loading, empty, and error states, expired sessions, private downloads, editing/supplementing/completing, pagination, reloading after dialog closure, error retry, deletion confirmation including focus/Escape and retry, and an account change with a late response. Existing API fixtures for ownership rights and evidence remain authoritative and unchanged.

Red steps were actually run with `node tests/notification-link-ui.test.mjs`, `node tests/customer-localization-ui.test.mjs`, `node tests/my-reviews-page.test.mjs`, `node tests/notifications.test.mjs`, and `node tests/my-reviews-ui.test.mjs`: modal frame, old menu/email return path, missing redirect, missing initial loading notice, or missing login return after session expiry. The same commands pass after implementation. Every fixture uses fictional accounts and content; none sends real emails or changes production data. `tests/i18n-worker.test.mjs` additionally checks private documents and legacy redirects in both actually built Worker artifacts.

Native verification on 2026-10-06 used the specified Chrome profile, actual components, and project CSS with fictional responses for personal history. At 390 pixels in dark mode with a populated list, 1280 pixels in light mode with an empty state, and 390/1280 pixels with system theme and error/loading states, document and scroll widths each matched the viewport; system theme was light on this computer. The overview had no dialog overlay. The loading notice was visible and refresh disabled; empty/error messages and the privacy notice remained reachable. A targeted submission showed one record; complete history showed four. Browser back/forward restored those targets. Supplementing opened existing form values and the previous fictional evidence; Tab reached the private download link.

Independent review and a DOM probe reproduced focus on `BODY` after dialog closure. The additional red step failed on expected return to the triggering supplement action. The corrected UI suite passes with 33 checks: close/Escape/cancel for supplementing, editing, completing, and deletion confirmation; delayed list refresh; refresh as the focus target after removed rows; and preservation of later navigation or focus movement. Native rechecking confirmed focus on supplement or delete after Escape. Return behavior follows the [APG dialog workflow](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

At the actual local app server, the old English submission link returned HTTP 307 to the new localized URL. Direct visits and browser reload returned HTTP 200 with “My reviews” and the same validated target; the login button contained the complete localized return path. Server output was `noindex,nofollow`. In the native profile, React also reported a hydration warning for `cz-shortcut-listen` on the body; this attribute was absent from newly read server HTML and indicates browser injection. These checks use no real accounts or evidence, change no provider configuration, and confirm no new live provider activation.

## Google login

The Google OAuth app and web client were created in the existing Cloud project. JavaScript origin is `https://riparim.com`; the redirect is the OAuth callback address supplied by the existing Supabase project. The secret client key belongs only in Supabase's Google provider setting. Login needs only `openid`, profile, and email, as described in the [official setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

The user stored the client key directly in Supabase, enabled the provider, and confirmed successful real Google login. Google branding is not yet verified; the account selection window therefore currently shows the technical Supabase domain. Fixture results alone do not confirm production Google login.

When reconciling with the concurrently published theme, Google logout was corrected: the header uses the app logout endpoint for Google and email, revoking the current session and removing provider cookies. The native ChatGPT logout path remains intended for ChatGPT accounts. The header regression check reproduced the previous bug and passes after correction; auth route checks additionally confirm revocation of a previously verified Google session.

## Self-service account management

Account settings were checked with fictional accounts: validated display name without changing existing review names, fresh password verification and Google OAuth confirmation, separate deletion confirmation, foreign account targets, expired permissions, and protected administration access. UI checks include keyboard focus, Escape, cancel, disabled actions during running requests, and retry of an interrupted deletion. The UI was also checked in the browser with fictional data in a light desktop layout and dark mobile layout.

Storage regression checks pause an evidence upload before writing to R2 and start account deletion meanwhile. Deletion removes the empty R2 reservation so that the atomic ETag condition rejects the late file write. Even on failed compensation, private file contents must not be stored afterwards. The inventory makes necessary cleanup visible. Additional checks cover abandoned reservations with and without an existing R2 object. Another test successfully deletes the provider account and then fails local final cleanup: the account still appears as incomplete deletion in administration, and administrative retry works even with provider HTTP 404.

Checks change no real accounts and do not replace production verification of the new account section. D1 migrations `0009` and `0010` are required before publication; no new Supabase email templates are needed.

## Business access

The new business flow is checked with isolated accounts and a private SQLite database: request with private justification and evidence links, reasoned manual decision, assigned profiles only, drafts before publication, competition/duplicate cases, lost moderation rights, linked legacy owners, and cleanup on account deletion. Google fixtures check successful and failed contact validation without changing public assignment; concurrent decisions must adopt no foreign metadata. UI checks cover labeled forms, error/empty states, preserved input, status displays, confirmation dialog, keyboard focus, Escape, and blocked actions during running requests. No real business requests or Google queries are created. Moderation list and personal history have separate pagination; a fixture with 101 requests confirms that older pending requests remain fully reachable with identical timestamps. Invalid phone numbers and WhatsApp contacts produce correctable input errors. The business section and approval list were also checked in the browser with fictional data at 1280 pixels in light theme and 390 pixels in dark theme for labels and overflow. Migration `0011` is required before publication.

## Moderation notifications

Isolated delivery fixtures check atomic moderation/event storage, verified recipients and confirmed legacy links, private content, safe targeted login links, concurrent decisions and delivery attempts, durable backoffs including limits for failed recipient lookups, missing configuration/contacts, and network/database errors after a message has already been accepted. Retries use exactly the same content and idempotency key; expired keys and changed recipients or credentials cause blocked delivery events. The protected delivery API distinguishes queued events, handoffs, and uncertain outcomes, and allows no blind retry after expiry. The localized “Bewertungen prüfen” (“Review submissions”) page contains no delivery section; moderation decisions still trigger automatic delivery. React checks preserve search, keyboard filters, private evidence links, review decisions, pagination, and result counters. A targeted reload at the error state retries only list fetching, including after already successful moderation.

An additional Miniflare test runs the actual Worker scheduled handler with native D1. All provider requests are intercepted inside this isolated Worker; no real emails are sent. The scheduler hands off one event once and skips it on the next run. Before publication, migration `0012` is required, along with server-side Resend configuration and the five-minute cron declared in the artifact. The existing auth domain was read as verified and enabled for delivery at the service; real delivery of the new templates was not checked.

## Customer flows in three languages (Issue #50)

The isolated DE/SQ/EN matrix checks signup → confirmation → separate login
with the original workshop target, recovery → reset → login, Google success
and cancellation, Google reauth for self-deletion, and logout. APIs receive explicit
`locale`; missing values preserve German compatibility, and invalid values return
400 before provider/configuration access. The public callback and its
cookie paths remain `/auth/bestaetigen`. Its shared email contract starts
with `?locale=…&weiter=…`; old `type=signup` callbacks remain valid.

`tests/google-auth.test.mjs` uses real routes and a private SQLite
fixture with intercepted provider calls. `tests/account-settings.test.mjs`
checks the independent language preference on the verified own account,
metadata preservation, foreign targets, mixed payloads, role fields, and provider errors.
The language selector waits at most three seconds for saving; on failure
or timeout it navigates anyway and shows the safe localized
notice after reload. Native ChatGPT accounts skip the write attempt.
`tests/i18n-switcher.test.mjs` covers this contract; the local native
simulation preserves loopback/header/prefetch boundaries in
`tests/i18n-native-auth.test.mjs`.

Actual React/Radix components are checked by
`tests/customer-localization-ui.test.mjs` and
`tests/account-settings-ui.test.mjs` with active catalogues: localized
labels and errors, password visibility, keyboard star operation,
dialog focus/Escape, preserved original content, and existing canonical
service/evidence values. Account deletion requires exactly `KONTO LÖSCHEN`,
`DELETE ACCOUNT`, or `FSHI LLOGARINË`; only then does the
client send the existing German sentinel. Server-side self-deletion
grants and protection rules remain authoritative.

`tests/combined-reviews.test.mjs` compares successful download bytes and
headers and checks localized plain-text errors with identical 401/404 status codes and
`X-Riparim-Error-Code`. Customer and administration links use the same
download helper. Auth/account metadata and private landing query modes are
`noindex,nofollow` without public alternates; the ordinary landing page stays
indexable. Metadata fixtures and both actual Worker builds check
this boundary. None of these fixtures uses personal accounts, real evidence,
live emails, or production changes. Browser geometry/themes/zoom are
coordinated separately before PR approval.

## Business and administration in three languages (Issue #51)

Isolated React/Radix checks use the actually active
DE/SQ/EN catalogues: administration navigation, owner drafts, workshop editor,
user/role confirmation, review moderation, and auth configuration.
Original text, existing services/consultation languages, roles, status,
submission revisions, and technical project values remain unchanged
in requests. Localized errors preserve drafts and show no raw provider text.
Existing checks preserve keyboard focus, Escape, blocked actions during
running mutations, role/session revocation, and protected accounts.

Actual business, workshop, user, configuration, and
delivery routes are checked with isolated SQLite and intercepted
provider boundaries. Stable error codes and original HTTP/text contracts
also apply to SQ/EN requests. A delayed administrative display-name patch
must not reset an intervening changed language preference or other metadata.
This test checks the API key-merge contract, not production provider concurrency.

Delivery diagnostics translate states and causes and localize attempt counters
and Kosovo time, including daylight saving. The localized “An Versanddienst übergeben” (“Handed to delivery service”)
continues not to confirm delivery. Metadata fixtures and both actual
Worker builds check all six protected routes for `noindex,nofollow` without
private language alternates. Browser geometry, themes, and zoom are checked
separately before PR approval with a temporary harness of actual components and
fictional data. Personal accounts, real evidence, and
live emails are not fixtures; provider configuration and email activation
remain reserved for the follow-up issue and verified main release.

After integration of Issue #52, actual AuthSetup components
in all three locales check four separate subject/HTML fields and their
clipboard calls byte-for-byte against central Go exports. Technical source code
is displayed, not executed as HTML or translated. Rejected
clipboard calls show only localized manual-copy instructions. The displayed
adoption contract includes actual canonical origin values, preserved
callback permissions, release export and Go previews, all four provider files,
readback, receipt testing, and return path; not body-only adoption.

## Localized email templates and provider activation (Issue #52)

Central confirmation and recovery templates contain DE/SQ/EN subjects
and HTML bodies. Only the exact locale-first redirect prefix selects SQ/EN;
empty, short, old, or differing URLs remain German. The length guard
prevents a slice error in the unchanged body. Subject sources must
fit within the Supabase dashboard's 255-character field before rendering.
They use compact central subject copy and a full prefix comparison
with Go `printf` string precision instead of `slice`. The canonically validated origin is
ASCII (international hosts use Punycode); rune precision therefore matches
prefix byte length here. Short or missing redirects safely remain German.
HTML titles retain their longer copy; they need not match the shorter
subject. `tests/auth-email-export.test.mjs` checks actual
exported subject sources against the 255-character limit.
`tests/auth-email-templates.test.mjs` executes
both central fields with Go `html/template` without `FuncMap` and checks
special characters, token URL escaping, language, direct body containers, title, and CTA.
The [verified Supabase mailer](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/mailer/templatemailer/template.go)
parses both fields with `html/template`, then calls `subject.Execute` followed by
`body.Execute`. Local Go verification proves this source contract;
hosted subject evaluation is confirmed only by receipt testing.

Provider adoption happens separately from a verified main release:

1. In the existing Supabase project, back up the actual Site URL, redirect allowlist,
   and previous four subject/body fields as a private return path.
   SMTP credentials remain unchanged and outside the export.
2. Worker `SITE_ORIGIN` and the actually read Supabase Site URL must contain exactly
   the same canonical origin without a trailing slash. Export from the
   release checkout with the actually read provider value:

   ```sh
   npm run auth:email-templates -- \
     --site-origin https://riparim.com \
     --provider-site-url https://riparim.com \
     --output-dir /tmp/riparim-auth-mail-release
   ```

   The target directory must be new. Slash/path/origin mismatches produce
   `AUTH_EMAIL_ORIGIN_NOT_CANONICAL` or `AUTH_EMAIL_ORIGIN_MISMATCH`
   before output. German fallback is not a successful SQ/EN test.
   Export contains four provider sources, six synthetic
   actual Go previews with expected/rendered locale, and checksums.
   It changes no provider and contains no real tokens or recipients.

3. Allow only the public callback: production
   `https://riparim.com/auth/bestaetigen\?**`, and, when needed, separately the actually
   used local callback origin. No host/page wildcards and no
   `/sq/auth/…` or `/en/auth/…` callbacks. Preserve old callback links and
   required permissions; Site URL stays a plain origin.
4. Under Authentication → Email Templates, adopt `confirmation.subject.txt`
   and `confirmation.body.html` together for “Confirm sign up”, and
   `recovery.subject.txt` and `recovery.body.html` for “Reset password”.
   Alternatively use the [Management API fields](https://supabase.com/docs/guides/auth/auth-email-templates)
   `mailer_subjects_confirmation`, `mailer_templates_confirmation_content`,
   `mailer_subjects_recovery`, `mailer_templates_recovery_content`.
   Then read both fields again and compare byte-for-byte with the export.
5. Use provider preview and isolated, explicitly approved test accounts per locale:
   receive the actual subject/body, check confirmation → separate
   login to the original profile and recovery → reset → login,
   and old German links. Contact no real customers; addresses, passwords,
   and tokens stay private. Recovery writes no foreign metadata.
   If verification fails, restore the four backed-up previous fields
   and do not mark email approval as confirmed.

On their first attempt, review emails use only the allowlisted
`user_metadata.preferred_locale` of the verified confirmed recipient.
Moderator/cron/browser locale has no effect. Both decisions have
localized login/submission targets. Route, React, and native
D1/scheduled fixtures check DE/SQ/EN and foreign/private target boundaries.
`tests/notifications.test.mjs` compares actual `fetch init.body`
and the idempotency key after lost local confirmation, language changes,
and configuration changes. Historical German payloads preserve even
JSON order and whitespace. Recipient/credential changes, the 23-hour limit,
backoff, and controlled retries remain protected.

At the project's explicit request, new review emails send only subject
and HTML to Resend; the actual request body contains `text: ""` as
an explicit opt-out. Without this field, Resend automatically generates plain text,
as described by the [Send Email API](https://resend.com/docs/api-reference/emails/send-email)
and [changelog](https://resend.com/changelog/automatic-plain-text-emails).
Tests check this for both decisions and all three locales, plus
byte-identical HTML-only retries. Already frozen historical payloads with
`text` and old payloads without `text` remain unchanged to preserve their
idempotency contract. In the
[verified Supabase SMTP client](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/mailer/mailmeclient/mailmeclient.go),
`SetBody("text/html", body)` sets HTML only; provider fields
cannot configure an additional MIME plain-text part. Auth HTML is
entirely text-based and accessible. Export `.preview.txt` files
are only readability previews, not a claimed SMTP alternative. Check content type
and actual hosted mailer behavior during receipt testing.
This provider boundary is not bypassed through header tricks, hooks, or a new
email platform.

Automated fixtures and previews send no real messages and
change no production state. Native verification at 390/1280 pixels, 200% zoom,
and light/dark presentation, plus actual receipt and provider adoption,
are recorded separately before overall approval. Without this evidence,
the new provider configuration must not be described as accepted live.

## Compact login setup (Issue #59)

Administration shows four short verification steps and opens URL values, SMTP help,
Google settings, and long email sources on demand with native
`details`/`summary` elements. An already configured project and successfully
tested settings are reused. The connection therefore remains
directly reachable on the right; creating a new project or repeating
already accepted setup is not required.

Site URL and the public callback `https://riparim.com/auth/bestaetigen\?**`
remain required. The [redirect documentation](https://supabase.com/docs/guides/auth/redirect-urls)
recommends a fixed production path. The single backslash escapes
the question mark as a query separator; an unescaped `?` would be a
single-character wildcard. `**` preserves existing language/return parameters.
The allowlist does not replace app destination validation: Supabase already accepts
redirects to the site origin, while server-side destination validation by the
application remains authoritative and unchanged. The [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)
restricts default delivery to nonproduction purposes. Custom
SMTP setup therefore precedes template adoption: for new Free projects since June 3, 2026,
[template editing requires custom SMTP](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).
Confirmation and recovery templates continue to come directly from
`lib/auth/email-templates.ts`, each containing subject and HTML body.
Google still requires website origin, the Supabase project's callback,
and provider configuration according to the [official guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

`tests/auth-setup-ui.test.mjs` checks actual React/Radix components:
compact initial instructions in DE/SQ/EN, reachable native details, four
central copyable subject/HTML fields, reuse of the saved
connection, and unchanged draft/activation/SMTP contracts,
preview targets, and loading/error states. API fixtures have no external
effects. Integration of administration localization from Issue #51 preserved
forms, error codes, and locks during ongoing saving.
Origin comparison, release export, backup, readback, and rollback help are reachable
in all three languages inside collapsed email help; the
management UI suite continues to check source copying and localized copy errors.

Additional native verification in the specified Chrome profile used the
actual component and project CSS with only intercepted
`GET /api/auth-settings`: 390 pixels with system theme (dark on this computer),
1280 pixels light, and 390 pixels dark with URL/SMTP/email help open.
Document width and scroll width were identical (390/1280 pixels);
all four sources stayed within their 287-pixel-wide
scroll areas at 390 pixels. Empty configuration, loading state with a disabled save button,
and errors were readable; instructions remained reachable. Space closed
the help, Enter opened it. Tab reached the SMTP link, nested
confirmation help, subject, and HTML body; End scrolled the source to the
final `{{ end }}` with a visible focus ring. Verification changed no
provider configuration and triggered no live emails. The corrected
dashboard value was then confirmed natively with exactly one backslash;
document width also matched scroll width at 1336 pixels.

## Compact business management (Issue #60)

The localized “Mein Betrieb” (“My business”) entry leads directly to a request for an existing
workshop profile on the first visit. Without a confirmed profile or pending request,
this also applies after earlier decisions. Empty profile, request, and change boxes are omitted.
Confirmed profiles offer “Profil bearbeiten” (“Edit profile”); requests and changes explain
the next step according to their current review state. Historical rejections
show their result and review note without recommending a submission
that has since become blocked. Submitted change details and the
request for another profile open through native `details`/`summary`
elements. Ownership evidence and evidence links stay private; manual
ownership review and separate publication approval remain.

“Aktualisieren” (“Refresh”) stays reachable beside the page title because administration decisions
happen outside the open page. Fetching shows a
loading state and blocks concurrent submissions. If only reloading
fails after successful submission, the page confirms persistence and
asks for refresh instead of resubmission.

`tests/business-ui.test.mjs` checks actual React components for
direct entry, private and preserved input, review states and next steps,
compact details, blocked actions, initial loading, refresh, and
retry of a failed list fetch after successful submission.
`tests/business.test.mjs` also checks the authoritative list of pending
requests and change locks for owned profiles among more than 100 newer
historical decisions, and separation of foreign accounts. UI fixtures
check these current notices without prior pagination, history without a pending
request, old rejections with a pending replacement draft, and automatically rejected
competing requests. When loading a subsequent page, current assignment
and locks are adopted together; the two histories remain independent.
Current change requests also have their own IDs. Reloading both
lists removes stale review cards even after external approval,
rejection, or a replacement draft for the same profile. The client guesses no
decision; complete fetching shows the new review state and, where applicable,
the current replacement draft.
Existing moderation checks protect dialog focus, Escape, reasoned
decisions, and separate pagination. `tests/management-localization-ui.test.mjs`
continues to check DE/SQ/EN with original descriptions and canonical
service values. The entire test suite uses isolated accounts and intercepted
provider requests; it sends no real messages and changes no
production data.

Additional native verification in the specified Chrome profile used a
dedicated QA window with verified profile and controlled focus, and
current components, ThemeProvider, header, footer, CSS, and assets. At
1280 × 844 pixels in the light German desktop layout, the direct request,
refresh beside the title, and pending-request notices were understandable;
Tab and Space opened the additional request with a visible focus ring. At
390 × 844 pixels, Albanian in dark theme showed the change lock and
waiting notice; Tab and Enter opened submitted original details without
horizontal clipping. English in light mobile layout allowed keyboard
opening of the editor, access to the labeled phone field, and an
isolated submission: success message, unchanged public state,
closed editor, and blocked further editing were visible. German
in mobile system theme followed the system and resolved dark; request,
labels, and layout stayed readable. All API write attempts were intercepted with
synthetic data; production and real accounts were unchanged.
Loading, error, and failed-reload states are additionally checked automatically
and are not claimed here as natively accepted.

## Review entry at the workshop profile (Issue #62)

Variant A uses only the respective public workshop profile
for new reviews. The workshop is already selected there and the
complete review/private-evidence form is available. The
general dialog and localized “Bewerten” (“Review”) user-menu entry are removed. Personal submissions
can still be edited or supplemented directly.

`tests/review-entry.test.mjs` checks old `nachweis` links in DE/SQ/EN: known
public workshops lead to their profile with `#bewerten`; general,
unknown, invalid, or ambiguous targets lead to the workshop finder with
a localized notice. A catalogue error uses its existing
retry flow. The actual Worker test also checks
redirects and protects unpublished profiles. The finder notice
survives reload and language changes.

React checks confirm the absent general menu item,
visible workshop name on the form, profile login returns, joint
POST of review and private evidence, star/consent validation,
localized errors, and the approval explanation on success. Edits
continue to use PUT with revision and preserved private evidence; their
login destination is the person's own targeted submission. Existing isolated
API/SQLite/R2 checks protect uploads, ownership rights, and moderation.

These checks use fictional data and intercepted provider boundaries.
Native verification used Chrome with the confirmed project profile
`ramizloki82@googlemail.com`, real components, project CSS, and synthetic,
intercepted requests. At 390 pixels, System theme (light here), Light, and
Dark had no horizontal overflow; at 1280 pixels, the open form
was checked in dark theme with workshop name beside the fields. Viewport and
document width were each 390 or 1280 pixels.

The user menu has no general review link; Escape restores
focus to the trigger. Space operates the inline toggle, Tab reaches
the labeled date, and an arrow key selects the next star with focus.
The logged-out SQ profile check confirms the name and localized
login link returning to `#bewerten`. The EN finder notice and profile entry
were visible at 390 pixels with Chrome zoom actually set to 200%,
still without horizontal overflow; zoom was then
reset to 100%.

This native verification confirms no complete login, submission, or
file transfer; those contracts are covered by the isolated tests above.
There is no new migration or provider configuration.

After integration of Issue #61, “Meine Bewertungen” (“My reviews”) leads everywhere to the regular
private `/bewertungen` page with optional validated `einreichung`. The
targeted editing dialog uses the same localized login return
and completion link; its focus restoration remains. Old
`besuche`/`einreichung` links retain private page entry, including with a
simultaneous `nachweis` parameter. The unused general dialog hook is
removed. Additional integration tests check both link contracts and
existing personal page actions with fictional data.

## Profile-bound ownership request with document

The request uses only the public workshop linked through `werkstatt`
and shows its name and location. Other-profile selection and the
permanent refresh button are removed. Without a valid, unique target,
a notice leads to the workshop finder. The request contains private
evidence text and an optional upload for PDF, JPG, or PNG up to 5 MB.
After successful submission, the page reloads automatically; only a
loading error offers the localized “Erneut versuchen” (“Try again”) action. Existing evidence links stay in
administrative review. Only the applicant and administration can download documents
through a protected route.

Migration `0014` additively extends `workshop_claims` with nullable file metadata.
Existing requests need no data migration. The release process applies the
migration before the new Worker. Documents use the existing private
R2 bucket and upload inventory. Account deletion also removes documents and
orphaned uploads; conditional R2 writes prevent late content
after its reservation has been removed.

`tests/business-ui.test.mjs` checks the fixed name instead of profile selection, exactly one
text field and labeled upload, preserved input after errors,
absent refresh button, automatic status adoption, and retry
on loading errors, plus invalid and ambiguous targets. API/SQLite/R2 fixtures
in `tests/business.test.mjs` check private downloads, MIME/signature verification,
size limits without Content-Length, error cleanup, historical evidence links, and
account deletion during an upload. All data is fictional.

Native verification on 2026-10-11 used Chrome with the previously confirmed profile
`ramizloki82@googlemail.com`, the actual BusinessPanel component,
ThemeProvider, and built project CSS. The local preview used
synthetic responses instead of live accounts. At 1282 pixels light and 390 pixels
dark (SQ), the form was readable; viewport and document widths matched.
Tab reached the upload from evidence text, then the submit button,
with visible focus. English in mobile system theme resolved dark and
showed the loading error with “Try again” without a refresh button. This native
verification confirms no real file transfer or production adoption;
upload contracts are covered by isolated tests.

## Account name for reviews

Email registration requires a name of 2–80 characters and stores
it trimmed as `full_name`. `tests/google-auth.test.mjs` checks missing, empty,
too short, too long, and nontext names before calling the provider, plus
Google and older email accounts without names. Verified sessions use
the localized “Anonym” (“Anonymous”) instead of an email address for an invalid profile name.

`tests/combined-reviews.test.mjs` checks actual POST/PUT routes with
SQLite: submitted review names are ignored; new and edited
reviews adopt the current account name. Anonymous and 80-character
names can still be moderated and published. Existing
ownership, evidence, and approval checks remain. Changes only to the
account name do not rewrite existing reviews; the next edit
adopts the name with renewed moderation. No migration or
provider configuration change is required.

Actual React components check the required, labeled
registration field with associated help, name transmission,
and displayed account name without an editable review field in DE/SQ/EN. New and
edited reviews send no name field. Errors, preserved input,
star operation, and consent remain covered by the customer UI suite.

Native verification in the confirmed Chrome profile
`ramizloki82@googlemail.com` used real components and project CSS in
a local harness with fictional data and intercepted API requests. Registration
was readable in light desktop layout and at 390 × 844 pixels;
Tab moved from display name to email. The Albanian review form
at 390 pixels in dark theme showed the account name without an input field;
the arrow key changed star value and focus. English in system theme showed
the fallback “Anonym”; an 80-character name without spaces wrapped within
the mobile name display. This verification confirms no live registration
or real file transfer. No production data was changed,
and no emails were sent.

## Separate business overview and claim page

`/betrieb` is the private overview for owned profiles, requests, and changes.
It contains no request form or permanent refresh button.
For an empty overview, a notice explains entry through the public
workshop profile; a link opens the workshop finder. The owner link in the profile
leads directly to the standalone `/betrieb/beanspruchen?werkstatt=…` page.
Its page title is the localized “Werkstattprofil beanspruchen” (“Claim workshop profile”), with the fixed workshop and
only evidence text plus an optional private upload. After successful
submission, a confirmation replaces the form and links to “Mein Betrieb” (“My business”).
There is no automatic return redirect or embedded overview section.

Login and language changes preserve the request page with an unambiguous
workshop target. Ambiguous, missing, or unpublished workshops
show no form for another profile. A catalogue error offers a
targeted retry link. Both pages remain `noindex,nofollow`; the
user menu still leads to the overview. APIs, private documents, ownership rights,
and manual approvals use existing contracts; there is no new
migration or provider configuration.

`tests/business-pages.test.mjs` checks actual page documents
in DE/SQ/EN, separate titles, guest login returns,
invalid/ambiguous/unpublished targets, and catalogue errors.
`tests/business-claim-ui.test.mjs` checks labeled uploads, multipart data,
preserved private input, blocked competing submissions, and
confirmation without a form or an additional overview request.
`tests/business-ui.test.mjs` protects the empty overview, pending requests,
profile editing, and moderation without an embedded new request. Language switching,
header, and both actually built Workers are also checked.
All fixtures use fictional accounts and intercepted network requests.

Additional native verification in the confirmed Chrome profile
`ramizloki82@googlemail.com` used a dedicated QA window, actual
components, ThemeProvider, header, footer, assets, and built project CSS.
At 1282 pixels light, the request, synthetic keyboard submission,
confirmation without a form, and document link to the empty overview were checked.
At 390 pixels, English in dark theme showed only the request page;
Albanian in system theme (dark here) showed only the overview. Measured
request width matched the viewport (390 or 1282 pixels).
The preview intercepted write requests with fictional responses. This acceptance
confirms no real authentication or production file storage.

## Simplified review form (October 11, 2026)

Stars are sufficient for a review; text is optional and has no
minimum length. Review text and optional evidence note start collapsed.
Existing text stays visible when editing. Repeated introductions,
name explanations, and storage explanations are omitted; private evidence, visit details,
consent, and manual approval remain required. Text is adapted in
DE/SQ/EN. No migration or data transfer is needed.

`tests/combined-reviews.test.mjs` checks empty, missing, short, and long text,
invalid stars, nontext input, approval and public aggregates,
and text removal with renewed approval. Actual
customer and administration interfaces treat star-only reviews as complete.
CSS checks protect shrinking form groups and grid columns, and
the maximum width of native date fields in source and production CSS.

Native verification in the confirmed Chrome profile `ramizloki82@googlemail.com`
used the actual React component and compiled project CSS with
fictional data. At 320/390 pixels mobile and 1280 pixels desktop,
document and viewport widths matched. The date field stayed within its
label (262/332/600 pixels). Light and dark themes, star selection with
arrow keys/End, and expanding optional text with Tab/Enter were
checked. A real iPhone with Safari was not checked; automated
CSS boundaries do not replace acceptance on that device. The preview intercepts
write requests and changes no production data.

## Flat request page

Claiming uses no outer form card on desktop or mobile.
The localized “Profil beanspruchen” (“Claim profile”), compact workshop context, and short introduction
lead directly to evidence text and optional document. File selection has
its own visible labels in DE/SQ/EN; native browser text is visually
replaced while retaining the real file input for keyboard use and the file dialog.
Filename, replace, and remove are visible. Removing preserves
text and returns focus to selection. During submission,
fields are disabled and the button shows sending state. Confirmation
receives focus and links to the separate business overview.

Existing multipart, size, ownership, and approval contracts stay
unchanged; no new migrations or provider configuration are needed.
Actual React checks also cover selection state, removal,
focus, preserved drafts after errors, sending state, and confirmation focus in all three
languages. The native preview in the confirmed Chrome profile
`ramizloki82@googlemail.com` showed no outer card or horizontal overflow
at 1282 pixels light and 390 pixels dark. At 390 × 844 pixels,
“Antrag einreichen” (“Submit request”) was fully within the visible form area. English with
system theme resolved dark; Tab reached the visible upload focus ring,
then the send button. A local Enter submission led to the
confirmation title with focus. The preview uses fictional responses and confirms no real document transfer.

## Required documents and multiple selection

New ownership claims require at least one document; the “Optional” notice
is removed. Selection allows up to five PDF, JPG, or PNG files,
up to 5 MiB each and 10 MiB total. Additional selections append to the list;
each document can be removed individually. Cancelling the file dialog
preserves selection. Old requests without a file stay readable. Migration and
rollout compatibility are documented in [releases.md](releases.md).

Route fixtures check the requirement, including a JSON bypass attempt,
count/size/signature limits, private downloads of all documents, old
single files, compensation on later upload failure, and account deletion during
the second upload. UI fixtures check multiple selection, adding, removing,
errors with preserved drafts, downloads in overview and administration, and
confirmation with focus change in DE/SQ/EN. The full test suite passes.

Native verification in the confirmed profile `ramizloki82@googlemail.com`: desktop
(1282 px, Light Mode) and narrow (390 px, Dark Mode) show both files
without horizontal overflow. The native file dialog selects two isolated
test files together; keyboard focus reaches selection. After
locally intercepted submission, the confirmation heading receives focus.
The preview uses fictional accounts and local test files. No
production requests or evidence were created.

## CPU fast paths and manual single-event delivery (October 12, 2026)

Landing and privacy pages, like catalogue/profiles, are delivered from the verified release; personal account data comes only from the protected session API. Landing documents no longer contain the complete workshop catalogue. Legacy submission/evidence links, DE/SQ/EN, RSC, live unpublishing, and administrative catalogue read permissions remain protected by real Worker tests. Public catalogue GETs use the same data contract without the React page framework; administrative queries and all writes remain in the authorized request path.

Moderation awaits the first email attempt. The native D1 fixture confirms actual immediate handoff without a scheduled handler. Failures permit at most five manual retries after waits of 1/5/15/30/60 minutes. Tests check early requests, exhausted budgets, concurrent claims, unchanged payload bytes, recipient/credential changes, Resend deadlines, SMTP uncertainty, and absence of bulk delivery. The collapsible delivery overview loads only on request and does not poll. React checks protect labels, disabled actions, status/error messages, and retained moderation flows in DE/SQ/EN.

The local CPU profiler uses only an isolated workerd, canonical fixtures, and blocked provider access. It samples active CPU, not Cloudflare billing or a binding production ceiling. Measurement after a verified main release remains necessary for rare/private request paths. Native browser verification could not run reliably in this session because of repeated “The user changed Google Chrome” messages; no successful native layout/theme acceptance is claimed.

## Auth provider verification (Issue #139, October 12, 2026)

The actual setup component and all existing layout styles were
checked in the confirmed Chrome profile: DE Light at 1280 pixels, SQ Dark and EN
System at 390 pixels, plus loading, busy, and error states. Keyboard selection,
Tab focus, provider changes in draft, blocked fields/language navigation, and
provider-specific help worked without horizontal document overflow.
PocketBase shows no public-key field; the saving error message neutrally names
the auth service's address and configuration. Requests had only
synthetic responses and triggered no real provider writes or emails.

Automatically, actual adapters and app routes communicate with independent
Supabase/PocketBase protocol servers. The real Node HTTP test additionally checks
PocketBase through a local TLS instance, runtime bindings, existing private
ownership paths, profile/reauth flows, roles, controlled switching, privacy,
and logout. A separate local PocketBase 0.40.5 probe confirms its
current REST/ExternalAuth contracts with synthetic accounts. A real
Google client, production SMTP delivery, and live hash/account migration were
outside this probe's scope; prerequisites are documented in [auth-provider.md](auth-provider.md).

## Review dialog and multiple completed services

The localized “Bewertung schreiben” (“Write review”) action opens the dialog on the workshop profile with `?bewerten=1`.
Direct visits, reload, and browser back/forward restore its state;
existing `#bewerten` links remain valid. Language and validated
search return also survive the login return path. Closed drafts,
including a selected file, remain only in current page memory
and are bound to account and workshop. Successful submission starts
an empty draft on next opening, including browser forward after
closing the success view; the submit button is then present again.
The display name still comes server-side from the verified account;
the form contains no name input.

Migration `0025_dark_pretty_boy.sql` adds the nullable JSON column
`visits.services` and adopts existing `service` values as single-element lists.
The migration must be applied before new application code. Scalar
`service` remains the primary service for older clients. New
forms send `services` as a JSON list with one to six known categories;
the server validates each category and removes duplicates. Explicit lists replace
previous selection. Older editing requests preserve additional categories
if the primary service stays unchanged. Personal submissions, moderation, and
public reviews show every service in the selected language.
Permissions, visit evidence, and approval requirements remain unchanged.
If a previous Worker writes only `service` during deployment or rollback,
a changed scalar value takes precedence over the stale JSON list. Nullable
legacy inserts remain readable. These transitions are checked by
`tests/review-services.test.mjs` after applying the actual migrations.

`tests/profile-review-dialog.test.mjs` checks URL state, browser navigation,
draft/file preservation, account/workshop boundaries, and login return.
`tests/combined-reviews.test.mjs` checks saving, reading, editing, legacy clients,
moderation, and rejected service lists with isolated SQLite/R2 fixtures.

## Shared page frame and ordinary selection fields (October 13, 2026)

Header, content frame, and footer use the same `.wrap` width: at most
1440 pixels, with 56-pixel side margins on desktop, 32 up to 1000 pixels, and 16
up to 720 pixels of viewport width. Reviews, settings, and business overview
share title and spacing variables. Settings have flat outer
sections; the three theme cards remain. The ordinary review header
has neither back link nor refresh button. Loading errors allow targeted
reloading. If deletion removes the triggering row, the heading receives
focus; later navigation and other focus movements are still preserved.

Form pickers use `Field`/`FieldLabel` with separate associated labels
and bordered controls. Old colored `.field` containers are removed;
the landing page's integrated search layout remains. Only dialog content
scrolls. `overflow: clip` prevents keyboard focus from moving the outer dialog frame
or putting select dropdown positioning into a resize loop.

Native local acceptance checked settings, reviews, business, and catalogue
at 1491, 1030, 1000, and 390 pixels: header, content, and footer each
had identical edges without horizontal overflow. Theme selection was checked with mouse
and keyboard in Light and System. Town and visibility in the workshop editor
had transparent label containers, associated labels, and bordered controls;
visibility selection remained stable with Enter, arrow keys, and Escape,
without moving the dialog frame or producing a ResizeObserver message. No
workshop changes were saved.

## Client navigation without document reload (October 13, 2026)

Internal page links in the logo, user/administration menus, and customer flows
use the client router. Technical endpoints, downloads, external destinations, and
explicit error retries retain document navigation. The shared
release RSC header contains the build identifier embedded by Vinext; without it,
the browser discards prebuilt responses even from the same release and reloads
the target document. Actual build changes retain safe reload behavior.

Navigation tests use the actual Vinext Link and check
DE/SQ/EN, keyboard activation, menu closure, native link exceptions, and
cancelled clicks. The RSC regression test uses the actual
router planner. Built Worker verification compares public and private
RSC responses against the independently read framework renderer identifier.

The locally built Cloudflare Worker was checked in the confirmed Chrome profile
`ramizloki82@googlemail.com` with an isolated database and blocked
provider access. Before the header correction, login and logo
triggered additional document requests. Afterwards, login, logo through Tab/Enter,
and settings retained the same document counter; only RSC requests were added.
Verification changed no real accounts, emails, or production data.

## Stable login status in the header (October 13, 2026)

Live acceptance of v1.31.2 in the confirmed Chrome profile showed the same
`performance.timeOrigin` across landing → settings → privacy:
navigation loaded no new document. At the same time, the number of
`/api/session` requests increased from one to two to three; each new
check briefly showed the guest header. The new page instance started with
`account:null` even though the previous page had already confirmed the account.

The header now retains the last verified identity solely as a
display preview in current browser-document memory. The
server renderer never reads this preview; cookies and browser storage are
not added. Ordinary page changes share the verified session for
at most 30 seconds. The next access after expiry, tab/window return,
BFCache restoration, account changes, and an explicit retry recheck
it; concurrent consumers share the same running request.
Private data APIs independently check each access server-side. An
expired display preview is insufficient to load a private page. On first load, the header shows a labeled, nonfocusable
loading state instead of unconfirmed login buttons. An error stays
neutral; a confirmed guest response or local account deletion removes the
account menu. Responses predating an invalidation must not
restore the preview.

`tests/session-header-navigation.test.mjs` checks the actual header and
private review wrapper component with delayed/failed
session responses, client remount, server rendering, guest response,
invalidation, cache expiry, focus return, and a late old response. The existing deferred UI suite
continues to check DE/SQ/EN, role revocation, renaming, account deletion, and
concurrent session queries. All fixtures use fictional accounts.

## Header during a cold profile transition (October 14, 2026)

The signed-in live test moved from a workshop profile through the user menu
to personal reviews, business, and administration, then through browser back
to the profile. Private transitions showed neither guest buttons nor
document reloads. On the first profile visit in a fresh browser document,
however, the entire header was briefly missing: the actual Suspense fallback showed
only the localized “Werkstattprofil wird geladen …” (“Loading workshop profile …”). The state was reproduced
with a second profile and recorded as a screenshot.

The profile fallback now contains the same `SiteHeader` with `publicSnapshot`
as the data-free profile shell. It adopts the already verified identity
from shared browser session state; an unknown session remains
neutral. Existing request deduplication also applies during transition
to the loaded profile shell. There is no new authorization, data query,
migration, or additional browser storage.

`tests/profile-loading-header.test.mjs` renders the actual
route fallback in DE/SQ/EN and checks header, status label, server-side
identity isolation, and keyboard access. The client test moves from a
verified header into the fallback and protects account-menu retention without
an additional session query. Fixtures use only fictional accounts.

## Five-minute session cache and tab synchronization (October 14, 2026)

The browser-internal UI session cache stays fresh for five minutes. A new
client route uses the same verified response within this period. After
expiry or window return, it checks again; the known header remains
meanwhile. Server and protected APIs continue checking permissions
independently.

Successful password login, logout, password reset, and account deletion immediately
invalidate the cache. BroadcastChannel transmits only `signed-in`,
`signed-out`, or `refresh`; no identity, role, or tokens. Without
BroadcastChannel, the app uses short-lived storage events with signal and
nonce; blocked storage does not prevent local invalidation.
Received messages are not echoed.

A document's first successful `/api/session` call triggers rechecking in other
tabs. This also synchronizes Google/email and
native login returns with their server-set cookies. This check
changes no server-side auth rules and stores no account data in the browser.

`session-header-navigation.test.mjs` checks the actual header after 30 seconds,
immediately before five minutes, and after expiry. `session-cache-tabs.test.mjs`
checks independent module states in two tabs, login/logout without focus changes,
OAuth document return, late responses before logout, messages without
account data, echo prevention, storage fallback, and blocked storage.

## Google login in the Worker (October 14, 2026, Issue #183)

The live return reproduced `/anmelden?fehler=google&weiter=%2F%3Fbesuche%3D1`.
The auth provider confirmed successful PKCE code exchange and
user verification; the Worker then reported a `TypeError`. Independent
Google identity verification used `fetch` with `redirect:"error"`.
The configured Workers runtime supports only `follow` and `manual` and
rejected this call before the network request.

Verification now uses `manual`. Existing success-status checking
rejects redirects and other errors so that the Google bearer token
still goes only to the fixed userinfo endpoint. Identity,
session, and permission checks remain.

`node tests/google-auth-worker.test.mjs` reproduced the identical error return
with `TypeError` before the change and passes afterwards. The test
executes real start/callback routes, the Supabase SSR SDK, PKCE,
an asymmetrically signed ES256 session, and D1 in the native Workers runtime.
It checks ordinary sessions, DE/SQ/EN, safe return destinations, cancellation,
invalid flows, failed code exchange, Google errors,
and identity mismatches, plus redirect rejection without forwarding tokens.
All accounts, signing keys, and provider responses are isolated fixtures;
the test is registered in the regular runner. Successful production login
must be verified separately after adoption of the verified main release.

## English source refactor (14 October 2026, Issue #186)

The actual Cloudflare production bundle was checked in an isolated local
Miniflare Worker with D1/R2 fixtures and blocked outbound provider access. Native
Chrome QA used the project-mandated profile, verified from its account and window
information before local navigation. English catalogue navigation switched to
Albanian by keyboard, opened the same workshop profile, survived reload, and
switched to the existing German profile URL while retaining its search return.
The German and English login pages retained their localized labels, recovery
links and disabled-provider state.

Profile layouts were inspected at 390 and 1280 CSS pixels. The initial system
appearance, explicit light/dark switching and keyboard activation passed. The
English login layout was also inspected at a visually verified 200% browser
zoom. The temporary QA tab was closed after restoring its zoom.

These were isolated navigation/presentation checks; no live authentication,
account mutation, email, upload or provider configuration was performed. The
existing protocol and native Worker suites cover callback/privacy/cookie and
permission behavior. English physical page identities keep all established
DE/SQ/EN public paths, and `/auth/bestaetigen` still reaches the confirmation
handler through an internal rewrite without a sensitive redirect.
