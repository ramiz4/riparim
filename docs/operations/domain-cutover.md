# Domain and writer cutover

For a newly authorized switch, use the [provider-switching checklist](provider-switch.md).
Complete preparation and data transfer before routing: verified release, backups/recovery,
paused writers, fresh reconciliation and a return path are required. The completed Sites cutover is
[historical evidence](../archive/domain-cutover-2026-10-05.md).

## Prepare routing

1. Inventory/back up DNS, nameservers, TTL, CAA, DNSSEC and TLS privately. Preserve
   email/verification records. Rehearse the exact authorized apex/www replacements;
   nameserver changes and app routing are separate actions.
2. Verify routing permissions before announcing downtime. Cloudflare custom domains
   need Worker permissions plus `Workers Routes Write` for the owned zone. Wrangler
   may replace conflicts; reconcile expected DNS changes before deploying.
3. Match `SITE_ORIGIN`, verified artifact/routes, target bindings, preview access and
   TLS. Production is `https://riparim.com`; www redirects preserve path/query.
4. Preserve the Auth provider/project and [identity mappings](auth-provider.md).
   Check bound secrets, Google scopes/callback, browser-key restrictions and unchanged
   verification-file bytes. Supabase Site URL and `/auth/bestaetigen` allowlist must
   match; avoid host wildcards. Preserve template token-hash/`.RedirectTo` contracts.
5. Announce the operating window/time zone, operator and fallback decision only after
   preparation/backup capture can support the estimate.

## Change routing

With both sides drained/paused, verify maintenance text, `no-store` and release identity.
Record Go/No-Go for conflict-free data, provider identity, DNS/TLS/access and executable
return. Unknown write acknowledgment requires a fresh inventory. On No-Go before target
writes, resume only an unchanged verified source.

Apply only the authorized routing plan. Verify HTTPS/apex/www and the served release;
keep repository routes/bindings consistent through a verified main release. Enable the
accepted target as sole writer, keep old/alternate URLs locked, and report resumption
or overruns. Export-token expiry never unlocks the source.

## Accept and observe

Record time, host, release, expected/actual results and protected evidence references.
Use isolated marked data/accounts and prove cleanup. Check:

- Apex/www/TLS, HTTP→HTTPS, path/query redirects and the Google verification file.
- Navigation/search/profiles, keyboard, mobile/desktop and supported themes.
- Real email and Google login started on the production domain, return/logout,
  revocation, blocks and legacy links. A technical-host login cannot prove domain OAuth.
- Admin/moderation, own/admin private files, denied foreign/anonymous access, hidden
  drafts and ineffective forged Sites headers.
- Sole writer, app/Auth/DNS errors, delivery and separately configured monitors.
- A subsequent suitable main release and artifact retry preserve target commit/bindings.

Agree observation criteria and duration. Record operator acceptance separately from
fallback retention. Retirement/final deletion need their own authorization.
For recovery, use the [data-preserving return procedure](provider-switch.md#return-after-a-failure).
Code rollback must fit the current schema, preserve locks/routes and changes no D1/R2 data.
