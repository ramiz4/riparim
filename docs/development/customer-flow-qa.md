# Customer-flow QA

Choose checks for the changed behavior. Use actual components or the built Worker,
isolated D1/R2, fictional accounts/files and intercepted providers. Confirm the
`ramizloki82@googlemail.com` browser profile from available account/window
information before browser actions. Past checks are
[historical evidence](../archive/customer-flow-history.md), not current acceptance.

## Browser matrix

- Check DE/SQ/EN, 390 and 1280 CSS pixels, Light/Dark/System and 200% zoom.
  Add 320 pixels for dense forms. No horizontal overflow or clipped controls.
- Use Tab/Shift+Tab, Enter/Space, arrow keys and Escape; check labels, visible
  focus, dialog focus/return and focus after a removed row or confirmation.
- Cover initial/loading/empty/error/success states and retries. Preserve drafts
  after errors; busy controls prevent duplicate submissions and unsafe navigation.
- Test direct visits, reload, client navigation, back/forward, safe login returns,
  locale switches and legacy URLs. Private text/files/tokens never enter public
  links or alternate metadata. Restore temporary zoom/viewport settings afterward.

## Auth and account

Check registration (trimmed display name), confirmation → separate login with
original target, recovery → reset → login, Google success/cancellation, logout
and reauthentication for deletion. Reject invalid/expired tokens, foreign targets,
forged native identity and unsafe redirects. Provider errors show safe messages.

Settings preserve concurrent metadata/language preferences. Name changes do not
rewrite old reviews; the next review edit adopts the verified account name with
renewed moderation. Review forms accept no client-supplied name. Deletion removes
private files/reservations and supports retry after partial provider/local cleanup;
late uploads cannot recreate removed evidence.

The header keeps its verified display during client transitions and profile loading.
Check cold load, failed/late session answers, guest/account changes, five-minute
expiry, window return and cross-tab login/logout. Browser signals contain no
identity/tokens; server APIs independently authorize every private access.

Tests: `google-auth.test.mjs`, `google-auth-worker.test.mjs`,
`account-settings.test.mjs`, `account-settings-ui.test.mjs`,
`session-header-navigation.test.mjs`, `session-cache-tabs.test.mjs`,
`profile-loading-header.test.mjs` in [tests](../../tests).
Provider setup/mail acceptance follow [auth operations](../operations/auth-provider.md).

## Reviews and private evidence

Start a review from its public workshop profile. `?bewerten=1`, legacy hashes,
login return and browser navigation preserve dialog state. Draft/file state is
bound to current account/workshop and remains only in page memory. Success starts
an empty next draft. Stars suffice; text is optional. Required visit, consent,
private evidence and approval still apply. One to six distinct known services
retain scalar legacy compatibility.

Check personal `/bewertungen` history, targeted submissions, pagination, editing,
supplementing, deletion and retries. New/edited submissions stay private until
approval; editing removes their public review. Approve/reject through authorized
moderation and verify public aggregates/refresh. Anonymous/foreign evidence access
fails; own/admin downloads preserve exact bytes. Check upload size/signature,
replacement failure and account deletion during delayed upload.

Tests: `combined-reviews.test.mjs`, `review-services.test.mjs`,
`profile-review-dialog.test.mjs`, `my-reviews-page.test.mjs`,
`my-reviews-ui.test.mjs`, `notification-link-ui.test.mjs`,
`public-review-refresh.test.mjs`.

## Owners and administration

Claim only a valid published target from its profile; ambiguous targets show no
foreign form. Claim page and private overview remain separate. New claims need
one to five PDF/JPG/PNG documents, at most 5 MiB each/10 MiB total. Check append,
cancel, individual removal, labeled native selection and confirmation focus.
Old requests remain readable; downloads are applicant/admin only.

Ownership is manually approved and grants only assigned-profile rights. Profile
changes require separate moderation and current revision/owner permissions.
Check competing requests, role removal, pending locks, stale lists and account
cleanup. Editors preserve original business text/canonical values and newer
administration changes. See [data contracts](../data/workshops.md).

Tests: `business.test.mjs`, `business-ui.test.mjs`, `business-pages.test.mjs`,
`business-claim-ui.test.mjs`, `admin-workshops-ui.test.mjs`,
`admin-roles-ui.test.mjs`, `management-localization-ui.test.mjs`.

## Delivery and completion

Moderation awaits the initial email attempt. Failure does not undo approval.
Check one-event manual retries, five-attempt budget/backoffs, atomic leases,
unchanged payload/idempotency and ambiguous SMTP locks. Provider acceptance is
not recipient delivery. Diagnostics load on demand without polling; there is no
periodic retry job. Use `notifications.test.mjs` and `smtp-tls.test.mjs`, and follow
[mail operations](../operations/mail-transports.md).

Run required [CI checks](../../.github/workflows/ci.yml) for code changes. Record
tested artifact/release, matrix and limits. Browser fixtures prove presentation,
protocol fixtures prove isolated contracts, and production auth/mail/storage
require their own acceptance after a verified main release. Claim only observed
results; real iPhone/Safari and live email delivery are separate checks when needed.
