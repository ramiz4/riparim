# Customer-flow QA

Test the changed behavior with actual components or built Workers, isolated D1/R2,
fictional accounts/files and intercepted providers. Before browser actions, confirm
profile `ramizloki82@googlemail.com` from available account/window information.
[Past checks](../archive/customer-flow-history.md) do not establish current acceptance.

## Browser coverage

- Check DE/SQ/EN at 390/1280 CSS pixels, Light/Dark/System and 200% zoom; add 320 px
  for dense forms. Controls must remain visible without horizontal overflow.
- Use keyboard navigation, activation, arrows and Escape. Check labels, visible
  focus, dialog return and focus after removed rows/confirmations.
- Cover loading, empty, error, success and retry states. Errors preserve drafts;
  busy controls prevent duplicate submissions and unsafe navigation.
- Test direct visits, reload, client navigation, history, locale switching and legacy
  URLs. Private text/files/tokens never enter public links/metadata. Restore viewport/zoom.

## Auth and account

- Exercise registration, confirmation → separate login with original target,
  recovery/reset/login, Google success/cancellation, logout and deletion reauthentication.
  Reject invalid/expired tokens, foreign targets, forged identities and unsafe redirects.
- Preserve concurrent name/language metadata. Review forms accept no client-supplied
  name; name changes leave old reviews unchanged. Editing adopts the verified
  account name and returns the review to moderation.
- Check cold/failed/late sessions, guest/account transitions, five-minute expiry,
  window return and cross-tab login/logout. The header retains verified display;
  broadcasts carry no identity/tokens and server APIs authorize each private access.
- Deletion removes private files/reservations and can resume after partial cleanup;
  delayed uploads must not recreate removed evidence. Verify provider mail separately:
  [Auth operations](../operations/auth-provider.md).

## Reviews and evidence

- Start from a public workshop profile. Review links, login returns and history
  preserve dialog state; drafts/files belong only to the current account/workshop
  in page memory. Success clears the next draft. Stars suffice; text is optional.
- Required visit, consent, evidence and approval still apply. Check one-to-six distinct
  known services and scalar compatibility, personal history, pagination, edits,
  supplements, deletion and retries. Edits remove the previously public review.
- Authorized approval/rejection updates public aggregates. Anonymous/foreign evidence
  access fails; own/admin downloads preserve exact bytes. Check size/signature,
  failed replacement and deletion racing a delayed upload.

## Ownership and administration

- Claim only the selected published profile; ambiguous targets show no foreign form.
  Keep claim and overview separate. Require 1–5 PDF/JPG/PNG documents, ≤5 MiB each/
  10 MiB total; check selection, append/cancel/remove and confirmation focus.
  Old requests stay readable; downloads are applicant/admin only.
- Manual approval grants assigned-profile rights only. Profile changes need separate
  moderation and current revision/ownership checks. Exercise competing requests,
  removed roles, pending locks, stale lists and cleanup. Editors preserve original
  business text, canonical values and newer admin changes: [data contracts](../data/workshops.md).

## Delivery and completion

- Moderation awaits the first email attempt; failure does not undo approval.
  Check one-event retries, the five-retry budget/backoffs, atomic leases, unchanged
  payload/idempotency and ambiguous SMTP locks. Diagnostics load on demand without
  polling; there is no periodic retry job. Follow [mail operations](../operations/mail-transports.md).
- Run required [CI checks](testing.md). Record artifact/release, coverage and limits.
  Presentation/protocol fixtures prove their isolated scope; production auth/mail/storage
  require independent acceptance after a verified main release. Provider handoff is
  not inbox delivery; real iPhone/Safari and live receipts remain separate when relevant.
