# Move the production domain and login to the owned Worker

This guide executes [#19](https://github.com/ramiz4/riparim/issues/19) after the
verified [data transfer](data-transfer-2026-10-04.md). It is an execution plan,
not proof of an already migrated domain. For completion, actually performed
steps, times and results are recorded in a separate acceptance report.
Private reports and backups remain outside Git; public evidence contains only
counts, checksums, resource identifiers and check results.

The actual cutover on October 5 and its technical check results are in the
[acceptance report](domain-cutover-2026-10-05.md). The proven technical operator
acceptance and separate fallback period for #20 were handled separately.
The latter ended by explicit user decision; [public Sites retirement](sites-retirement.md)
has been performed.

## Initial state and responsibility

During preparation on October 4, 2026, Sites version 42 with the verified main
release v1.2.0, commit `bf0af1913102710925efcadbfa9d3fff7631b694`, is online
again. Sites is the only production write path. The owned Worker is on
`MIGRATION_READ_ONLY=true`; its latest published release is v1.2.5, commit
`0cdd587af67b54286cae7635c834e1926af3fdde`. These inventories have not remained
continuously synchronized since the source resumed.

The agent assigned in this chat coordinates publication, data reconciliation,
routing and Go/No-Go. Other running chats may complete their own changes;
this gives them no second production write source.
Before domain cutover, the header/home fix from
[#31](https://github.com/ramiz4/riparim/issues/31) and production navigation from
[#33](https://github.com/ramiz4/riparim/issues/33) must be integrated, published
and verified on the actually built target. Both changes were integrated through
[PR #34](https://github.com/ramiz4/riparim/pull/34) and
[PR #35](https://github.com/ramiz4/riparim/pull/35) and published in v1.2.5.
Final navigation through the production domain remains part of acceptance after
target activation. An open PR or green local build does not replace a published
main release.

| Resource                    | Fixed target                                                                  |
| --------------------------- | ----------------------------------------------------------------------------- |
| Source Site                 | `appgprj_6abfd028b7e48191822a15d44cbbda8d`                                    |
| Production domain           | `https://riparim.com`                                                         |
| Canonical www redirect      | `https://www.riparim.com` to `https://riparim.com`, preserving path and query |
| Cloudflare account / Worker | `ec181b3a61c7c3da13910600953fc3ea` / `riparim`                                |
| Target D1                   | `riparim-production`, `b395ea3a-5316-4b0b-bdee-533bdb68d6a0`                  |
| Target R2                   | `riparim-evidence-production`, private                                        |
| Technical target host       | `https://riparim.riparim-ec181b.workers.dev`                                  |

## Preparation while the source is available

1. Recheck current releases, main commit, open PRs, deployment status and running
   Git work. Update the task branch from clean, freshly fetched `main`.
   Publish exclusively from the verified GitHub release archive according to
   [releases.md](releases.md).
2. Fully back up the existing DNS zone and reconcile it in the owned Cloudflare
   zone. Apex, www, all other subdomains, email/verification records, TTLs, CAA
   and DNSSEC state belong in the inventory. An automatic DNS scan does not
   replace complete reconciliation. SPF, DKIM, DMARC and Sites verification
   remain until separate retirement. Nameserver changes and app routing are
   separate operational decisions: initially preserve the same Sites targets
   while activating the new zone.
3. Prove active zone, delegated nameservers and HTTPS for apex and www.
   The owned zone uses `Always Use HTTPS`; after the server switch, HTTP
   requests must still switch to HTTPS with unchanged path and query.
   Do not yet remove the old Sites domain mapping. Preparations that would
   cause a DNS conflict or interrupt the existing website remain outside
   the ongoing operating window.
4. Prepare the owned Worker with `SITE_ORIGIN=https://riparim.com` from a
   verified main release, initially without active production routing.
   The target remains frozen. Runtime values, D1/R2 bindings, cron and the
   security boundary are checked against the unchanged release artifact.
   Prepare, review and fully verify a second PR with exactly the two custom
   domains `riparim.com` and `www.riparim.com` for zone
   `cb2470c7a7d49b8a3e6aa3e697c3355e`. Integrate it only in the final operating
   window. No release archive or generated `dist/server/wrangler.json` is
   edited afterward.
5. Locally prepare final reconciliation against the archived baseline from #18.
   It must detect source additions, modifications and deletions, handle target
   deviations separately and compare private R2 objects, including metadata
   and references. Repeated insert-only import is insufficient after source
   resumption. Unknown conflicts stop the plan. Implementation and retryability
   must be tested with isolated data before the public pause. Reviewed tools,
   protected inputs and bounded workflow projection are in
   [domain-data-delta.md](domain-data-delta.md).

Cloudflare custom domains require an active owned zone and cannot be configured
on a host with an existing CNAME. The www CNAME to `custom-domains.chatgpt.site`
present during preparation must therefore not be overlaid with another domain
mapping without verification. Determine the concrete routing plan from the
actual DNS/TLS inventory and fully prepare it before the pause.
[Cloudflare custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

In addition to existing Worker/D1 permissions, the activation deployment needs
`Workers Routes Write`, exclusively for the `riparim.com` zone.
The current roles guide requires this zone permission for custom domains and
Worker editor access too; custom domains currently support no roles scoped to
an individual Worker. A successful Worker code deployment does not prove this
permission. Give the existing CI token the specifically required scope only
after the prepared verification. General DNS write permissions are not
automatically part of app deployment. Separate DNS reconciliation may still
use operator access. Missing routing access is a No-Go before the public pause.
[Cloudflare routing permissions](https://developers.cloudflare.com/workers/authorization/workers/#routes-and-custom-domains)

The pinned Wrangler sets options to replace conflicting DNS records and existing
origins during noninteractive custom domain deployment. Expected changes to all
affected apex/www records must therefore already be backed up and reconciled in
the routing plan. Automatic conflict resolution during CI publication does not
replace this plan. The preparation release's empty `routes` list activates no
production domain.

## Configuration and authentication

| Contract                  | Check before cutover                                                                                                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Origin and routing        | Source and generated artifact use the same `SITE_ORIGIN`, intended routes/custom domains and `workers_dev`/preview state. No additional domain or unrelated zone.                                                                                    |
| Release verification      | `assertCloudflareDeployConfig` also compares routing and access through technical URLs; transplanted or unexpected routing is rejected. Vars, cron, account, Worker, DB and bucket remain verified.                                                  |
| Auth data                 | `auth_settings`, roles, blocks, sessions and confirmed `auth_links` retain their Supabase project namespace. No reassignment from matching email addresses.                                                                                          |
| Protected values          | Securely transfer the existing moderator identity, `SUPABASE_SECRET_KEY`, both Google keys, Resend configuration and required activation values. No values in reports or source code; the deployment token stays outside Worker runtime.             |
| Public Auth configuration | Project address and publishable/anon key still come from `auth_settings`. No new `NEXT_PUBLIC_*` configuration or Auth project creation is required. The administrative `/api/auth-settings` endpoint stays protected.                               |
| Supabase                  | Site URL `https://riparim.com`; permitted app callback `/auth/bestaetigen` with existing return/flow parameters. Confirmation/recovery templates still use token hash and `.RedirectTo`. Allow only the required callback, no general host wildcard. |
| Google OAuth              | JavaScript origin `https://riparim.com`; redirect URI remains the unchanged Supabase project's callback. OAuth client, secret and scopes are preserved.                                                                                              |
| Google Maps               | Browser key allows the actual HTTPS production host; separate API restrictions are preserved. Server key is exposed neither in HTML nor in the browser bundle.                                                                                       |
| Ownership file            | `/googled8cf505b6c63892b.html` returns unchanged verification content through the production domain.                                                                                                                                                 |
| Private evidence          | R2 stays private, without `r2.dev` or its own file domain. Ownership, moderation and block checks apply server-side.                                                                                                                                 |
| Platform headers          | The owned Worker removes incoming `oai-authenticated-user-*`; forged headers grant neither login nor moderation rights.                                                                                                                              |

Changing the web server changes neither the existing Supabase provider callback
nor Google accounts. App callbacks, however, are derived from `siteOrigin()`.
After that value changes, they use `riparim.com`. A login starting on `workers.dev`
and returning to the production domain does not replace Google acceptance:
flow/PKCE cookies belong to the starting host. Final acceptance must happen
entirely on the production domain. Existing host-bound cookies on `riparim.com`
should continue to be checked against the unchanged Auth project after the
server switch.
[Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls),
[Google OAuth with Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google),
[Google key restrictions](https://developers.google.com/maps/api-security-best-practices)

## Announcement and final operating window

The public pause starts only once preparation, release and final reconciliation
are ready. Before activating it, announce in chat:

> Issue #19: Final data transfer starts on [date] at [time, time zone]. Riparim
> is expected to be briefly unavailable until [date/time, time zone]. Checks on
> the new server follow. If there are deviations, I will report the current
> state and next step before this expected end.

Actual values are determined from the ready work plan and measured transfer
runtime. Placeholders are not an announcement. Document start, expected end,
actual resumption and any abort decision. Inform the user if the announced
window is exceeded; a maintenance lock must not remain unobserved.

1. The target remains frozen. Enable the source pause and check its actual
   maintenance marker, release identity and `Cache-Control: no-store`.
   Scheduled tasks and earlier background work must also have drained.
   A general HTTP503 error does not prove a safe write pause.
2. Create fresh complete source/target backups, verify checksums and recovery
   according to [data-transfer.md](data-transfer.md). Produce the final three-way
   comparison with the verified #18 baseline. Do not automatically overwrite
   unrelated changes or broadly replace sessions or business data.
3. Apply only the reviewed change plan, then again reconcile complete inventories,
   deletions, private objects, metadata, references and blocks. A successful
   retry is a no-op. Resolve lost acknowledgments through reconciliation;
   do not blindly write again.
4. Record Go/No-Go. Go requires the exact deployed release, all dependencies,
   valid domain/TLS, identical Auth project identity, preserved admin/ownership
   rights, conflict-free final reconciliation and an executable return path.
   On No-Go, the target stays frozen. Before routing, the unchanged source can
   be explicitly reopened if no target write occurred and source data stayed
   unchanged.
5. Bind the two custom domains specified above once to the already verified
   staging release of Worker `riparim`. This operational step authorized in the
   main runbook changes neither its code, DB nor release archive. First recheck
   the complete existing domain set: unknown Worker mappings stop cutover.
   Only backed-up Sites apex A and www CNAME targets may be replaced; email and
   verification records are preserved. Both sides stay frozen; check HTTPS,
   apex/www and the expected maintenance marker/release commit. Then integrate
   the prepared routing PR. Its main release permanently adopts the same two
   domains in Wrangler and must deploy automatically to the already bound
   production domain. Prove release, artifact hash, deployment and actually
   served commit. Only then enable the target as the sole writer. The source
   stays frozen, including for clients with old DNS answers and alternative
   Sites access paths.
6. Perform acceptance immediately. The technical Worker host uses the same
   target data; it must not open a second differing data source. Source, export
   access, domain mappings and backed-up artifacts remain controlled until #20.
   Expired export values must not be confused with automatic resumption of
   source write access.

## Acceptance and observation

Every check records time, host, release/commit, expected and actual result.
Production personal, token and file data is not recorded. Privileged tests use
isolated accounts and clearly bounded test data; prove cleanup afterward.

- Apex and www: valid certificate, HTTPS, accessible root page, canonical
  redirect preserving path/query, Google verification file.
- Actually served production bundle: logo/root, search, settings, privacy,
  account/business links, forward/back navigation, prefetch without the errors
  from #33, mobile and desktop headers from #31.
- Email and Google: login, correct callback/return target, logout and session
  revocation. Existing sessions, blocks, confirmed legacy links and private
  ownership remain correct. Actual Google login is proven separately from
  provider fixtures.
- Administration and moderation: permissions, protected configuration, open
  cases, permitted own/admin file access and rejected foreign/anonymous file
  access. Forged platform headers remain ineffective.
- Workshop search/profiles: approved data, stable IDs, Google identity, browser
  API permissions and error fallbacks. No incorrect draft appears publicly,
  no server key in the client.
- Availability and operation: observe app errors, Auth errors, Worker/DNS/TLS
  status, scheduled notifications and the sole write source.
- Subsequent suitable main release: automatic successful deployment to the same
  production domain, unchanged bindings/routes, traceable release commit and
  archive SHA-256. A retry uses exactly the same release.

The assigned operator performs technical acceptance and documents the actually
observed period with specific start, end, criteria and result. The final report
states observed errors, their reviewed corrections and the business flows
performed. #19 is closed after this proven technical operator acceptance.

The separate fallback period for #20 remains independent. Its agreed end and
the retirement decision are explicitly documented before publication, domain
mappings, background work or old access are disabled. A proposed deadline does
not count as an agreed end. Inventory, protected archive and a reviewable
retirement plan can already be prepared while the source is frozen.
Fallback resources remain until authorization and are no second write source.
Final resource deletion requires separate authorization after retention expires.

## Recovery after routing cutover

A code rollback changes no D1/R2 data. Restore a verified release compatible
with the current schema on the owned Worker or publish a reviewed forward fix
through main. The owned database remains authoritative. New configuration must
not silently reset the maintenance lock or routing.
[Cloudflare rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

If domain traffic actually has to return to Sites, first freeze both writers
and background work and prove this. Secure new protected backups of both sides.
Plan the delta created on the target since cutover against the cutover baseline,
transfer back all inserts, modifications, deletions and private files, and
perform full reconciliation and Auth/permission checks. Only then route back
and reopen only the source. An unverified reverse transfer is not an available
return path. If this path is not demonstrably executable, preserve target data
and use a documented forward fix. Do not reopen a source outdated since cutover;
no data restore may destroy new user writes.

The acceptance report records at least release/commit/archive hash and deployment,
DNS/TLS/routing evidence, announced and actual times, protected backup/delta
references, Go/No-Go and responsible owner, business checks, technical observation
period, operator acceptance, separate fallback period status and remaining
work for #20.
