# Customer-flow evidence: October 4–14, 2026

Historical acceptance scope, not proof of current deployment. Use the
[QA checklist](../development/customer-flow-qa.md) for new work. Except explicitly
identified live checks, browser/component/protocol tests used fictional accounts,
isolated storage and intercepted providers; no production writes/messages.

## Live checks on October 4

Registration/confirmation and recovery/password change were actually delivered
and user-confirmed. Token-hash templates preserved the original review return;
email approval stayed in protected runtime data. The user configured the existing
Google OAuth client in Supabase and confirmed real login. Branding remained
unverified then; technical provider-domain display was not claimed resolved.
No credentials, tokens or personal addresses were stored in documentation.

Local review submission with private PNG returned 401 anonymously, became public
only after approval, returned to review on edit, and was fully removed afterward:
private evidence 404 and zero R2/multipart/part objects. No synthetic production
customer review was published. Account/ownership/deletion and provider-failure
contracts were separately exercised in fixtures.

## Localization and mail (#47–52)

Native beta.5 Worker checks discovered HTTP200 route misses after rewrite and
missing Albanian date/number/collation ICU. Explicit 404 gating and shared SQ
formatting/collation were checked in both Worker builds and browser fixtures.
DE/SQ/EN covered safe returns, metadata, privacy, canonical values, moderation
and account preference without translating original business/user content.

The Go `html/template` export checked confirmation/recovery subject+body,
255-character source limit, locale-first prefixes, escaping and six synthetic
previews. Supabase's verified
[mailer](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/mailer/templatemailer/template.go)
executes both fields. Local previews did not prove hosted receipt. Adoption
required exact origin/callback, backup, paired sources, byte readback and real
isolated receipt per locale; new provider adoption was not claimed accepted here.
Review mail fixtures preserved payload bytes and `text:""` for new HTML-only
Resend messages; historical frozen payloads stayed unchanged.

## UI acceptance and regression evidence

| Period/issue                                  | Observed scope and retained limits                                                                                                                                                                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| October 6, personal reviews #61               | Standalone history, targets/back-forward, private downloads and focus recovery checked at 390/1280 px; 33 UI checks covered close/Escape/deletion fallback. Browser-injected `cz-shortcut-listen` was absent from server HTML.                                                            |
| Compact auth/business #59–60                  | DE/SQ/EN actual components, details/source scrolling, saved connection reuse, owner/change states and error preservation; desktop/mobile themes and keyboard accepted. Writes were intercepted.                                                                                           |
| Review entry #62                              | Profile-bound reviews, legacy return links, no general review menu, focus and stars checked; EN finder/profile at 200% zoom. No real login/upload proved.                                                                                                                                 |
| October 11, ownership documents/account names | Fixed-profile claim, private upload, verified account-name display and long-name wrapping checked at 390/1282 px. Claims/overview became separate pages; historical optional single upload was superseded by required multi-document flow.                                                |
| October 11, simplified review/claim           | Star-only reviews, collapsed optional text, native dates and flat claim form checked at 320/390/1280 px; real iPhone/Safari remained unchecked.                                                                                                                                           |
| Multi-document claims                         | Native dialog selected two local files, keyboard reached labels, confirmation took focus; 390 dark/1282 light had no overflow. Real transfer was not claimed.                                                                                                                             |
| October 12, CPU/manual delivery               | Native D1 fixtures proved awaited initial send and bounded individual retries; unreliable browser automation prevented successful native acceptance in that session.                                                                                                                      |
| October 12, auth provider #139                | DE light/1280, SQ dark and EN system/390, keyboard/provider drafts/loading/errors checked without real writes. Independent Supabase/PocketBase protocol servers and local PocketBase 0.40.5 checked adapter contracts; live Google/SMTP/hash migration stayed outside scope.              |
| October 13, review dialog/services            | URL/back-forward/drafts/account boundaries and one-to-six services checked. Migration `0025` adopted scalar services; actual migration tests retained older-client/rollback precedence.                                                                                                   |
| October 13, shared frame/selects              | 1491/1030/1000/390 px had matching header/content/footer edges. Theme keyboard and stable native selection avoided outer dialog movement/ResizeObserver messages; no workshops saved.                                                                                                     |
| October 13, client navigation                 | Before/after built Worker browser counters reproduced full-document navigation, then retained document while RSC increased; release renderer header fixed router reuse. No real accounts/data touched.                                                                                    |
| October 13, header session                    | Live v1.31.2 retained `timeOrigin` but each route rechecked session and flickered guest. Isolated header/private wrapper tests protected retained display and independent authorization.                                                                                                  |
| October 14, profile fallback/cache            | Cold fallback visibly lost header; actual fallback now retains shared header. Five-minute cache/tab fixtures covered expiry, invalidation, late answers and no identity/token broadcasts.                                                                                                 |
| October 14, Google login #183                 | Live provider exchange succeeded before Worker `redirect:"error"` failed. Actual Workers callback/SDK/PKCE/ES256/D1 regression passed with `manual`, including redirect rejection without bearer forwarding. Successful new production login still needed independent release acceptance. |
| October 14, English source #186               | Isolated built Worker with blocked providers: keyboard EN→SQ→DE preserved profile/search and reload; 390/1280 themes and EN login at 200% zoom passed. No live auth/mail/upload/provider change.                                                                                          |

Most browser matrices used the required verified Chrome profile
`ramizloki82@googlemail.com`. System theme varied by session. Test migration,
protocol and presentation results prove their stated fixtures only. Production
adoption, actual delivery, larger private inventories and real-device behavior
must be verified independently when relevant.

Current auth/provider adoption lives in [auth operations](../operations/auth-provider.md),
data/migration contracts in [workshop data](../data/workshops.md), and CPU limits
in [the dated CPU report](issue-149-cpu.md).
