# Releases and publication

Changes reach `main` through a pull request. Production may be updated only after squash merge, successful verification and an associated GitHub release. Feature branches and open PRs must not be published through Sites.

## Conventional Commits and squash merge

The PR title becomes the squash commit and is checked with Commitlint. Examples:

- `fix: correct workshop search` produces a patch version.
- `feat: add appearance settings` produces a minor version.
- `feat!: replace the profile API` produces a major version. Alternatively, a `BREAKING CHANGE:` footer appears at the end of the PR description.
- `docs:`, `test:`, `ci:`, `build:`, `refactor:` and `chore:` alone normally produce no release.

New local commits also use this format. Check: `printf '%s\n' 'feat: add settings' | npm run commitlint`. Historical commit messages are not rewritten.

GitHub permits only squash merges. `main` requires a PR, a current successful CI run and the **Conventional PR title** check; rules also apply to administrators. Versioned configuration is in `.github/repository-policy.json`. A repository administrator can apply it with `npm run repo:configure` and check it with `npm run repo:check`. These commands need appropriate `gh` authentication, not Site credentials.

## GitHub Actions

Title, Semantic Release and deployment jobs install only their separately locked
tools. Full app installation remains in the verification job.
Dependency audit, pin updates and measurement evidence are in
[ci-tool-installs.md](ci-tool-installs.md).

The **Release** workflow starts only on `push` to `main` in `ramiz4/riparim`. It uses Node.js 24 and works with the exact merge commit:

1. Reusable CI performs catalogue checks, tests, TypeScript, lint and Cloudflare, Sites and Node builds.
2. Node and Cloudflare/Sites pass two immutable Actions artifacts with exact IDs to the release job. The final gate confirms all required branches. Run, repository, commit and SHA-256 must match; partial reruns may reuse successful producers from an earlier attempt of the same run. The [CI performance process](ci-performance.md) describes partitioning and measurement.
3. `semantic-release` analyzes Conventional Commits since the last `v*` tag and creates a tag, release notes and GitHub release with three archives, each with its own provenance file.
4. The validated `DEPLOYMENT_TARGET` repository variable selects `cloudflare` (default) or `node`. Node starts no Cloudflare deployment and needs no Cloudflare secrets; installation uses the [host-local Node path](node-deployment.md). For Cloudflare, the deployment job downloads both files from this published GitHub release. It checks tag, commit, checksum and target bindings, applies pending D1 migrations and publishes exactly the verified artifact bytes to Cloudflare. A repeated deployment uses the same release, not a new build.

The automatically provided `GITHUB_TOKEN` receives `contents: write` only in the release job. No npm packages are published, no release commits are written to `main` and no additional PATs are required. The first release starts at `1.0.0` without an existing version tag; subsequent releases follow SemVer bumps. Tags and GitHub releases are the version source; private `package.json` is not changed on every publication.

Release runs are serialized and not cancelled during publication. A commit superseded before release creation produces no release; the newer `main` run incorporates changes. An already published release is deployed even if a documentation-only or maintenance commit has since reached `main`. Only a newer fully published release prevents deployment of an older version, including a retry of only the deployment job. Rerunning the same commit reuses an already fully published release.

Renewed measurement after runtime optimizations and the decision against
preemptive queue restructuring are in [release-queue-analysis.md](release-queue-analysis.md).
Full retries still check the builds and provenance for the respective release
format; an existing published tag is reused before comparing remote main.
Only new publications are superseded by a newer main commit.

If GitHub publication fails after tag creation, the workflow explicitly remains failed. Before rerunning, complete the existing release and associated assets: historical releases have four assets (Cloudflare/Sites pair), new releases with `riparim-release: node-v1` additionally have the Node pair, totaling six; create no additional version tag. A missing, draft or incomplete release is not reported as success.

## Production migrations, retries and rollback

The deployment job applies D1 migrations **before** Worker upload.
Meanwhile the previous Worker and its scheduled handler continue serving requests;
schema and code do not switch atomically together. New migrations must therefore
be compatible with the still-active version and intended code return path.
Applied SQL files remain unchanged; every change gets a new Drizzle migration.

Use multiple releases for incompatible changes: first extend the schema
additively, then transfer data through a reviewed repeatable backfill and switch
readers/writers. Remove old columns or tables only in a later separately reviewed
migration when no active or rollback-target code needs them. Before production
data changes, create a protected backup with verified recovery; announce any
required write pause beforehand with time window and resumption.

On an error, freshly check schema and `d1_migrations`. Already successful
migrations remain applied even if subsequent code upload fails. Do not delete
history or rerun SQL without verification. On unknown outcome or differing
schema, stop the run and clarify the inventory. After resolving the error,
rerun the same published release: it rechecks provenance and ordering, skips
applied migrations and uses unchanged archive bytes. First check the actually
active Worker version, secrets, bindings and maintenance state.
A newer fully published release still takes precedence.

A code rollback is allowed only with the current schema and existing data;
it resets neither D1 nor R2. The usual correction path is a reviewed forward fix
through main. Return to Sites follows the
[separate reconciliation plan](domain-cutover.md#recovery-after-routing-cutover)
and [archive recovery](sites-retirement.md#recovery-and-safe-interruption).
A backup restore that would lose new writes is no safe rollback.
[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/),
[Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Cloudflare production

Backup monitoring runs in the separate `riparim-backup-monitor` Worker.
Website releases deploy only the app artifact and change neither the monitor's
cron nor secrets. `wrangler.backup-monitor.jsonc` is authoritative for monitor
updates: authorized active variables and the 15-minute cron are versioned and
preserved by a normal deployment. CI checks the automatic monitor run with
exactly this configuration in real workerd. Monitor updates too may use only
a verified published main release. Process and explicit pausing are in
[backup-monitoring.md](backup-monitoring.md#cloudflare-active-deployments-and-updates).

`wrangler.jsonc` contains the owned target account, Worker `riparim`, verified D1 database `riparim-production` and private R2 bucket `riparim-evidence-production`. Vite adopts this configuration for production builds. Local previews use isolated bindings; production resources stay separate from the local development server with `remote: false`. Generated `dist/server/wrangler.json` is deployed unchanged from the release archive.

D1 and R2 are created before the first deployment and their exact bindings verified. The deployment command disables Wrangler's automatic provisioning with `--experimental-provision=false`. This avoids the additional R2 metadata query on the first Worker upload in particular; the deployment token needs no R2 read or object permissions.

The GitHub `production` environment allows only branch `main`. Two secrets are configured there:

- `CLOUDFLARE_API_TOKEN`: separate account token for automated deployments and D1 migrations. Initial Worker creation requires Workers Product Admin and D1 Write; after bootstrap, Workers access can be reduced to Editor for this Worker. Active custom domains additionally need `Workers Routes Write`, exclusively for the owned `riparim.com` zone. General DNS, billing, R2 object and token management permissions do not belong to app deployment.
- `CLOUDFLARE_WORKER_SECRETS`: JSON containing at least `REVIEW_MODERATOR_EMAIL` and required Google keys, `SUPABASE_SECRET_KEY` for user administration and confirmed notification recipients, `RESEND_API_KEY` and `TRANSACTIONAL_EMAIL_FROM` for transactional review messages or one-time activation values. For an authorized Auth host, also `AUTH_TRUSTED_ORIGIN`/`AUTH_TRUSTED_PROVIDER` and separate credential binding; for PocketBase `AUTH_ADMIN_KEY`, `AUTH_ADMIN_KEY_ORIGIN` and `AUTH_ADMIN_KEY_PROVIDER=pocketbase`, for compatible Supabase `SUPABASE_SECRET_KEY_ORIGIN` according to [auth-provider.md](auth-provider.md). The moderator value must match the existing Riparim admin. Deployment tokens do not belong in this runtime JSON.

Secrets must not be stored as repository secrets: PR workflows receive no access to the protected production environment. Codex MCP authentication stays separate. Application secrets are uploaded together with the Worker using `--secrets-file`, briefly held in a file with mode `0600`, then removed. A later publication without new values preserves existing Worker secrets.

Moderation awaits an immediate send attempt. Failed messages are retried only individually and manually: at most five times in addition to the initial send, after waits of 1, 5, 15, 30 and 60 minutes. The Worker exports no scheduled handler; `triggers.crons: []` removes the previous schedule during verified release deployment. No new migration: existing events, attempts and frozen delivery bytes are preserved. Historical events with six or more attempts are exhausted.

`SITE_ORIGIN=https://riparim.com` is a normal variable in Wrangler configuration. Only apex and www are registered as enabled custom domains in the owned zone; preview URLs remain disabled. The technical Workers host uses the same inventory. Deployment checking enforces these routing boundaries and unchanged configuration in the release archive. Missing CI credentials explicitly fail the deployment job. Local `wrangler deploy --dry-run` checks validate package and bindings, not remote permissions.

## One-time switch from Sites

[Data transfer](data-transfer-2026-10-04.md), [production cutover](domain-cutover-2026-10-05.md) and [controlled public Sites retirement](sites-retirement.md) are complete. D1 data, including Auth configuration, identities, roles, sessions, ownership and approval status, was reconciled; private R2 and migration history are verified. The owned Worker is the sole writer. The old Site is owner-only and remains write-locked; its data, versions and backed-up archives are preserved according to documented retention. An empty new database with applied schema migrations is not a transfer of existing user data.

The first Worker release initially permits deployment checking. Login and administration need the transferred active `auth_settings` row and values belonging to the existing Supabase project. `REVIEW_MODERATOR_EMAIL` and `SUPABASE_SECRET_KEY` alone do not create this configuration; no unprotected bootstrap route is provided.

Technical acceptance includes actual email/Google login, administration, private evidence and workshop search through the production domain. Native ChatGPT accounts need a confirmed Supabase link for private legacy data; matching email addresses alone permit no mapping. Schema/data changes are not automatically reset by a code rollback. For an error after cutover, the current owned D1/R2 inventory remains authoritative; reverse transfer and reopening the old Site require documented safe reconciliation.

The owned Worker removes incoming `oai-authenticated-user-*` headers. These can represent native platform identity on OpenAI Sites; on the owned publicly accessible Worker they come from the client and must grant neither login nor admin rights. Supabase login and session checks remain.

Overall production cutover completion is in the [final report](release-handover-2026-10-05.md). Associated work is tracked in [Issue #17](https://github.com/ramiz4/riparim/issues/17): [data transfer #18](https://github.com/ramiz4/riparim/issues/18), followed by [domain/Auth cutover #19](https://github.com/ramiz4/riparim/issues/19) and, after accepted cutover and the fallback period ended, [Sites retirement #20](https://github.com/ramiz4/riparim/issues/20).

References: [semantic-release](https://semantic-release.org/recipes/ci-configurations/github-actions/), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), [GitHub squash merges](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests), [Cloudflare CI](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Workers permissions](https://developers.cloudflare.com/workers/authorization/workers/).

## Verified Sites archive for data transfer

CI builds both provider targets from the same verified commit. Alongside the
regular Cloudflare artifact, the GitHub release contains a Sites archive and
its own provenance file with project ID and SHA-256. Sites still uses the
platform adapter and logical DB/BUCKET bindings; the owned Cloudflare archive
is unsuitable for that. Regular publication to the owned Worker stays automated.
The one-time source publication uses only the unchanged verified Sites release
archive. Required write pause, protected backup and Go/No-Go checks are in
[data-transfer.md](data-transfer.md).

### Apply locale email templates

Issue #52 needs no migration or new secrets. The main release includes central
Go subject/body templates for confirmation and recovery; Worker deployment
does not automatically change Supabase templates.
[Provider activation](customer-flow-qa.md#localized-email-templates-and-provider-activation-issue-52)
requires exact comparison of `SITE_ORIGIN` and the actually read Site URL,
export/Go preview from the release checkout, private backup and transfer of all
four provider fields, rereading and isolated receipt tests in DE/SQ/EN.
Approval requires both the verified release and provider acceptance.
A code rollback does not restore provider fields; use the backed-up four fields
for that. Preserve existing SMTP values and callback paths.

New review emails send only subject and HTML; `text: ""` disables Resend's
automatic plaintext generation. They use the validated recipient preference
on the first send. Already frozen messages retain their original language and
identical request bytes, including historical plaintext parts, on retries;
they need no data transfer. The Supabase SMTP source contract supplies HTML
without its own MIME plaintext part; this documented provider scope remains
visible during receipt acceptance.

## Public static catalogue releases

The Cloudflare build renders catalogue and published profiles in DE/SQ/EN with
an isolated local workerd. It uses only verified canonical data; runtime accounts
and reviews never enter HTML artifacts. Shells containing no data accompany
changed live profiles. The small public request path checks status/revision
against D1 before serving an asset. Private pages and RSC remain in the existing
Worker.

The verified archive also contains `dist/catalogue-import.json`.
The deployment job compares the plan with the same central statement factory
and canonical source of the release commit. After D1 migrations, bounded
revision-protected upserts are executed externally, followed by the completion
marker and only then Worker upload. An error suppresses upload;
the same published release remains retryable. This prevents the first HTTP
request from having to import the entire catalogue under the Workers Free
CPU limit. Newer admin revisions, existing customer links and removal markers
remain protected. There is no new migration or additional paid resource.

For catalogue changes, retain a protected local backup of affected catalogue
tables with isolated recovery verification before merging.
The daily routine follows [the run contract](daily-workshop-import.md).

## Mandatory documents for ownership claims

Migration `0015_noisy_rockslide.sql` additively adds `workshop_claims.documents`
as a JSON list defaulting to `[]`. There is no data loss or backfill:
readers still use `file_key`, `file_name` and `file_type` for old single files;
this also applies to writes by the previous Worker during deployment.
New requests store all documents and mirror the first file into those old
columns. The previous Worker can continue after a code rollback, but shows
only the first document. All files stay in the private bucket; account deletion
removes every file through the existing upload inventory and account prefix.
Export/restore check all JSON references.

Only new requests require 1–5 documents: PDF, JPG or PNG, up to 5 MiB each,
10 MiB total. Historical requests without a file remain reviewable.
The multipart route limits the actually read body to 11 MiB and accepts multiple
`file` parts; text fields remain unique. JSON requests cannot bypass mandatory
documents. Downloads authorize the claim before selecting a document by its ID.

## Own workshop opening hours

Migration `0020_married_magus.sql` adds two nullable columns to `workshops`.
It is compatible with the previous Worker and needs no backfill.
Old owner drafts and catalogue imports preserve approved opening hours.
After the release, public profiles no longer load Google widgets;
existing external Maps and directions links remain available.
Confirmed owners submit weekly schedules and exceptions through existing moderation.

## Multiple services per review

Migration `0025_dark_pretty_boy.sql` adds `visits.services` as a nullable JSON
column and transfers existing `service` values as single-element lists.
Before production backfill, create a protected platform backup with successful
isolated recovery verification. The deployment job applies migration before
the new Worker; existing migrations remain unchanged.

New writes still mirror the first category into `service`.
The previous Worker can continue during deployment and after code rollback:
new legacy rows without JSON read as a single category. If it changes only the
scalar field, that takes precedence on reread over a differing first JSON
category. This prevents losing old Worker changes on another upgrade;
stale additional categories are no longer displayed in that case.
With a matching first category, multiple selection is preserved.
A code rollback does not remove the column and shows only the primary category
in the old Worker. Visit evidence and its access rules remain unchanged.
