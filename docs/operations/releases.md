# Releases

Production accepts verified GitHub Releases from squash-merged `main` only. Feature
branches/open PRs never publish, including through Sites. This private project does not
publish npm packages. Never run local live releases or edit tags/versions manually.

## Publish a change

1. Use the [Conventional Commit/version rules](../../CONTRIBUTING.md#commits)
   for the PR title. Documentation changes normally create no release.
2. Pass required PR checks and squash merge. Keep breaking-change notes in the
   final commit body.
3. Watch **Release: Publish and deploy** verify the exact main commit, package
   immutable artifacts, publish through Semantic Release and deploy.
4. Confirm release, deployment and actually served commit separately. Test affected
   customer flows on the production domain.

Release jobs run serially with minimum permissions and protected CI secrets.
A superseded unpublished commit enters the newer run. A published release
remains usable after documentation commits; a newer complete publication supersedes it.
The [workflow](../../.github/workflows/release.yml),
[release policy](../../scripts/release-policy.mjs) and
[repository policy](../../.github/repository-policy.json) own exact rules.
Authorized administrators use `npm run repo:configure` / `npm run repo:check`.

## Configure a target

`DEPLOYMENT_TARGET` selects `cloudflare` (default) or `node`. Use the release's matching
archive/SHA-256 provenance pair unchanged; never swap targets or use a partial/draft
publication. Node uses its [prebuilt installer](node.md) without a target build.

[wrangler.jsonc](../../wrangler.jsonc) owns Cloudflare account, Worker, D1, private R2,
origin/routes. The verified archive carries its generated configuration. Local previews
use isolated bindings; production provisioning and preview URLs stay disabled.
Only apex/www serve production; incoming `oai-authenticated-user-*` headers grant no rights.

The protected GitHub `production` environment allows only `main`:

| Secret                      | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`      | Deployment/migrations and routing write for the owned zone             |
| `CLOUDFLARE_WORKER_SECRETS` | Runtime JSON with Auth/Google/mail/moderator values and trust bindings |

Keep deployment tokens out of runtime JSON and PR-accessible repository secrets.
Preserve the existing moderator/Auth project; secrets do not create `auth_settings`.
Runtime secret files use `0600` and are removed after upload; omitted secrets remain.
The deployment token needs no R2 object, billing or general DNS permissions.
[Mail](mail-transports.md), [Auth templates](auth-email-templates.md) and the separate
[backup monitor](backup-monitoring.md) have their own activation procedures.

## Migrations, retry and rollback

Migrations run before catalogue import/upload while previous code still serves requests:
code and schema do not switch atomically.

- Add new Drizzle migrations; never edit applied SQL/history. Extend first, then
  backfill/switch, then remove fields only when active/rollback versions permit it.
- Before data writes, back up privately and verify isolated recovery. Announce any
  required write pause and resumption.
- On failure, inspect actual schema, receipts, active code and maintenance state.
  Successful migrations remain applied after upload failure.
- For unknown outcomes, reconcile inventory. Retry the same published unchanged
  release; never blindly replay SQL or create another tag. If tagging succeeded but
  publication failed, complete that release/assets before retrying.
- Prefer a reviewed forward fix. Code rollback must fit the current schema and
  preserve D1/R2; restoring an old backup loses newer writes.

Catalogue edits follow [workshop data](../data/workshops.md). Publication validates its
release-bound plan and preserves newer revisions, customer links and removals; import
failure prevents upload. Private account/review data stays out of public HTML.
Completed migrations and past rollouts are [archived](../archive/README.md).
