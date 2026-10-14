# Domain and writer cutover

The Sites → owned Worker cutover completed on October 5, 2026; see its
[acceptance record](../archive/domain-cutover-2026-10-05.md).
Use this procedure for a newly authorized switch, after verified release and data transfer.

## Prepare before the pause

1. Verify current release/commit, target artifact/bindings, active writer and
   [data-transfer baseline](data-transfer.md). Keep the target frozen.
2. Privately inventory/back up DNS records, nameservers, TTL, CAA, DNSSEC and TLS.
   Preserve email/verification records. Nameserver changes and app routing are
   separate actions; rehearse the exact authorized apex/www replacements.
3. Verify routing permissions before announcing downtime. Cloudflare custom domains
   need Worker permissions and `Workers Routes Write` for the owned zone;
   successful code upload alone proves neither. Noninteractive Wrangler may replace
   conflicts, so reconcile expected DNS changes before deployment.
4. Match `SITE_ORIGIN`, generated artifact/routes, preview access and TLS to the plan.
   The production apex is `https://riparim.com`; www redirects with path/query intact.
5. Preserve the exact Auth project/provider and [identity mappings](auth-provider.md).
   Verify public Auth settings, separately bound secrets, Google scopes/callback,
   browser-key restrictions and unchanged Google verification-file bytes.
   Supabase Site URL and allowed app callback `/auth/bestaetigen` must match;
   avoid broad host wildcards. Templates retain token-hash/`.RedirectTo` contracts.
6. Announce actual start/expected end with time zone, operator and fallback decision.
   Preparation and backup capture must be complete enough to estimate the window.

## Final operating window

1. Freeze/drain source and target, including all delivery work and active requests.
   Prove maintenance text, `no-store` and embedded release identity on both sides.
2. Capture fresh complete backups, verify recovery and apply only the reviewed
   final reconciliation. Reconcile files, metadata, references, deletions and blocks;
   a retry must be a no-op. Unknown acknowledgment requires a fresh inventory.
3. Record Go/No-Go. Go needs the verified release, matching provider identity,
   complete conflict-free data, DNS/TLS/access readiness and an executable return path.
   On No-Go before target writes, explicitly resume only an unchanged verified source.
4. Apply only the authorized routing plan while both sides remain frozen.
   Verify HTTPS/apex/www and served release; reconcile repository routing through
   a verified main release so later deployments preserve the same domains/bindings.
5. Enable the target as the **sole writer** after deployment/data acceptance.
   Keep the old source locked for stale DNS clients and alternate URLs.
6. Perform customer acceptance immediately and report actual resumption/overruns.
   Export-token expiry never unlocks the source.

## Acceptance

Record time/host/release, expected/actual results and protected backup/report references.
Use isolated accounts/marked data; prove cleanup and omit personal/token/file data.

- Apex/www/TLS, HTTP→HTTPS, path/query redirects and direct Google ownership file.
- Published navigation/search/profiles, keyboard, mobile/desktop and supported themes.
- Email and actual Google login entirely on the target domain, correct return,
  logout/revocation; existing sessions/blocks and verified legacy links remain correct.
- Admin/moderation, own/admin private evidence and denied foreign/anonymous access;
  forged Sites headers remain ineffective and drafts stay private.
- App/Auth/DNS/TLS errors, sole writer, delivery and separately configured monitors.
- A subsequent suitable main release deploys automatically to the same target,
  with matching commit/hash/bindings. A retry uses the published artifact.

A login started on a technical host cannot prove production-domain OAuth:
PKCE/intent cookies belong to the starting host. Announce a defined observation
period with criteria and record operator acceptance separately from any agreed
fallback-retention period. Retirement and final deletion need their own authorization.

## Recovery after routing cutover

Prefer a reviewed forward fix or verified code rollback compatible with the
**current** schema. Code rollback changes no D1/R2 data and must preserve locks/routes.
To return traffic to a previous provider, freeze/drain both writers, create fresh
backups and verify reverse transfer of all post-cutover writes/deletions/files,
Auth mappings and delivery acceptances before reopening only that source.
An outdated frozen source is not an available automated fallback. If reverse
reconciliation is unproven, preserve the current inventory and use a forward fix.
The report names release/checksums, actual times, operator, Go/No-Go, data/domain
checks, observation, fallback status and remaining retirement work.
