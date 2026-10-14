# Releases

Production uses a verified GitHub Release from squash-merged `main`.
Feature branches and open PRs are never published, including through Sites.

## Publish a change

1. Use a Conventional Commit PR title: `fix`/`perf` → patch, `feat` → minor,
   `!` or `BREAKING CHANGE:` → major. Other types normally create no release.
2. Pass the required PR checks and squash merge. The title becomes the main commit;
   keep breaking-change notes in its body. Do not edit tags or versions manually.
3. Watch **Release: Publish and deploy**. It verifies the exact main commit,
   packages immutable artifacts, runs Semantic Release, then deploys the publication.
4. Confirm the GitHub release, deployment and actually served commit separately.
   Test affected customer flows on the production domain.

The workflow is serialized. A superseded unpublished commit creates no release;
its changes enter the newer main run. A published release remains deployable after
new documentation commits; only a newer complete publication supersedes it.

## Artifacts and targets

Each new release contains an archive and SHA-256 provenance file for Cloudflare,
Sites and Node. The `riparim-release: node-v1` marker requires all six assets.
Older four-asset Cloudflare/Sites releases remain retryable for those targets.
Archives carry the verified commit, run and target bindings; never swap targets.

`DEPLOYMENT_TARGET` selects `cloudflare` (default) or `node`; other values fail
before publication. Node installation follows [Node operations](node.md), with no
Cloudflare deployment. Tags and releases are the version source; no npm package
or version-changing commit is published.

Sources of truth:
[release workflow](../../.github/workflows/release.yml),
[release policy](../../scripts/release-policy.mjs),
[repository policy](../../.github/repository-policy.json).
Administrators apply/check repository policy with `npm run repo:configure` and
`npm run repo:check` using appropriate GitHub access.

## Cloudflare configuration

[wrangler.jsonc](../../wrangler.jsonc) defines the owned account, Worker `riparim`,
D1 `riparim-production`, private R2 `riparim-evidence-production`, origin and routes.
Production uses the unchanged generated configuration in the verified archive.
Local previews use isolated bindings; production provisioning is disabled.
Only apex/www serve the production domain; preview URLs remain disabled.
Incoming `oai-authenticated-user-*` headers grant no rights on the owned Worker.

The GitHub `production` environment permits only `main`:

| Secret                      | Purpose                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`      | App deployment and D1 migrations; routing write access only for the owned zone         |
| `CLOUDFLARE_WORKER_SECRETS` | Runtime JSON: moderator, required Auth/Google/delivery values and their trust bindings |

Keep deployment tokens out of runtime JSON. Preserve the existing moderator and
Auth project; secrets alone do not create `auth_settings`. Use protected environment
secrets, not repository secrets exposed to PR workflows. Runtime secret files use
mode `0600` and are removed after upload; omission preserves existing Worker secrets.
The deployment token needs no R2 object, billing or general DNS permissions.

Moderation awaits one immediate email attempt. Retries are individual/manual;
the app has no cron. [Mail operations](mail-transports.md) defines retry limits.
The separate [backup monitor](backup-monitoring.md) uses its own configuration,
cron and secrets; website releases do not update it.

## Production migrations, retries and rollback

D1 migrations run before catalogue import and Worker upload. The previous code
still serves requests during migrations; code and schema do not switch atomically.

- Create a new Drizzle migration; never modify applied SQL or migration history.
- Use separate releases to extend the schema, backfill/switch readers and writers,
  then remove old fields once active and rollback versions no longer need them.
- Before data changes, create a protected backup and verify isolated recovery.
  Announce any needed write pause and its resumption.
- On failure, check actual schema, migration receipts, active code and maintenance
  state. Successful migrations remain applied after a later upload failure.
- Resolve unknown outcomes by reconciling inventory. Rerun the same published
  release using its unchanged bytes; do not blindly replay SQL or create another tag.
- If publication failed after tag creation, complete that release and its required
  assets before retrying. Draft, missing or partial releases remain failures.
- Prefer a reviewed forward fix. Code rollback requires compatibility with the
  current schema and preserves D1/R2; restoring an old backup would lose new writes.

Catalogue publication validates `dist/catalogue-import.json` against the release's
canonical data, applies bounded revision-protected upserts, records completion,
then uploads the Worker. Failure prevents upload; retry preserves newer admin
revisions, customer links and removal markers. Runtime account/review data stays
out of public HTML. Follow [workshop data](../data/workshops.md) for catalogue edits.

Completed Sites migration evidence is in [the archive](../archive/release-handover-2026-10-05.md).
Provider email templates are a separate activation in [Auth email templates](auth-email-templates.md);
a code deployment or rollback does not apply or restore Supabase template fields.
Historic feature migrations are summarized in [schema rollouts](../archive/schema-rollouts.md).
