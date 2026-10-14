# Riparim

Find workshops in Kosovo, compare services and location, and contact them directly. Customers submit a review together with private visit evidence. The review is published only after an administrator has checked it.

Website: [riparim.com](https://riparim.com)

Contributors follow [CONTRIBUTING.md](CONTRIBUTING.md), and AI agents follow
[AGENTS.md](AGENTS.md): isolated task worktrees, Conventional Commits, and
Semantic Release as the release process.

## Technology

- React, TypeScript, and Vinext with App Router
- Cloudflare Worker, D1 database, and private R2 file storage; the new release pipeline uses the project's own Cloudflare account
- Application-owned auth contract with Supabase as the default and a concrete interchangeable PocketBase adapter for email/password and Google OAuth
- Daily encrypted Supabase auth backup: [operation and recovery](docs/auth-backups.md)
- Additional backup of auth configuration and D1/R2: [platform backups](docs/platform-backups.md)
- Prepared, disabled, portable email monitoring for both jobs on Cloudflare or Node: [backup monitor](docs/backup-monitoring.md)
- Drizzle for schema and SQL migrations

Only approved workshops and reviews are publicly visible. Evidence and account data are not stored in the repository. Workshop data includes sources; directory entries remain drafts until approval.

## Run locally

Requirements: Node.js 22 from 22.14 or Node.js from 24.10, and npm. CI uses Node.js 24.
`npm test` and auth email template export also require Go 1.27.1;
CI installs this pinned version. Templates are checked with actual Go
`html/template`, without modules or additional Go dependencies. If Go
is not on `PATH`, `RIPARIM_GO_BINARY` can point to the executable.

```sh
npm run install:ci
cp .env.example .env
npm run dev -- --host 127.0.0.1 --port 5174
```

The local UI is available at `http://127.0.0.1:5174`. Auth providers and login options are configured in the protected administration area. SMTP and Google OAuth must be configured and tested at the provider; source code alone does not enable them.

### Format code

`npm run install:ci` automatically activates the local Husky hook through `prepare`.
Before each commit, lint-staged formats only staged files with the
specified local Prettier version and adds the formatting to the index.
Unstaged changes are preserved, including in partially staged files.
A syntax error prevents the commit and restores the original index and
working state. The hook does not run full tests or builds.

```sh
npm run format
npm run format:check
```

Both commands use the same scope and configuration in
`.prettierrc.json`. It uses Prettier defaults; JSONC files receive no
trailing commas because existing Wrangler contracts read them with `JSON.parse`.
`format:check` changes no files and checks formatting
early in CI. ESLint continues to check code quality; the existing rules contain
no conflicting formatting rules. `.prettierignore` preserves generated
lockfiles and bindings, applied Drizzle migrations, and unchanged
vendor sources, including shadcn and the Sites Vite plugin.

For formatting on save, install the Prettier editor adapter and use the
local project version; the checked-in configuration is recognized automatically.
Editor formatting is optional. Git hooks can be bypassed locally;
the formatting check in CI remains required.

Every task worktree needs its own installation. Setup
writes the hook path into its Git worktree configuration and preserves hooks
in other worktrees. It enables `extensions.worktreeConfig` when needed; an
unusual shared `core.worktree` must first be moved into the configuration of the
primary worktree. CI uses `HUSKY=0`; `prepare` also skips
production installations, missing Git metadata, and installations without
Husky, such as isolated tool jobs. After a local installation with
`--ignore-scripts`, `npm run prepare` enables the hook.

`npm run dev` also uses the reviewed catalogue and existing opening-hours import source as default data in the local preview. Existing imported or business-confirmed hours, suppressed imports, and changed profile identities are preserved.

A new worktree needs the local database from the “Database and checks” section before the first page request. The development server uses the same logical D1/R2 bindings as the Sites build; existing migrations must be applied to this local database.

In local development mode, `/anmelden` shows the German UI button “Als Seedy anmelden” (“Sign in as Seedy”). Alternatively, `/dev/anmelden` leads directly to settings without a password; `?weiter=…` preserves a validated internal destination. This entry point and readable seed account data are restricted to the local loopback preview. Setting `REVIEW_MODERATOR_EMAIL=seedy@sites.test` in the ignored `.dev.vars` gives Seedy local administration access.

`REVIEW_MODERATOR_EMAIL` selects the administrator account and belongs in runtime configuration. `.env`, local databases, uploads, and build output are excluded from Git. `.env.example` contains placeholders only.

At `/verwaltung/benutzer`, administration manages the configured auth provider's email and Google accounts: view, create, edit, enable, disable, and delete. Supabase remains the default; PocketBase uses an independent REST protocol behind the same small app contract. Administrative operations use only server-side credentials separately bound to the provider and target origin. Migration `0018_auth_providers.sql` preserves existing Supabase settings/cookies and adds provider binding for private deletion grants. Setup, operational limits, hash/reset requirements, and safe account migration are documented in [docs/auth-provider.md](docs/auth-provider.md).

Administratively created accounts have verified email addresses and ordinary customer rights; no email is sent. Disabling an account immediately blocks new and existing sessions. After reactivation, a new login is required. Changes to email or password revoke existing app sessions. Deletion also removes associated visits, reviews, and private evidence, including linked legacy records. If an error occurs, the account remains blocked and deletion can be retried. Administration access is protected against blocking, deletion, and changes to its email address.

In user administration, admins can grant and revoke admin rights for other accounts. This role allows management of workshops, reviews and private evidence, user accounts, and login configuration. Assignment lives exclusively in the private D1 table `auth_account_roles`, is bound to the stable internal account ID, and cannot be set through provider profile metadata. Role changes revoke existing app sessions atomically with the role change; the affected person must sign in again with email/password or Google. Disabled or unverified accounts still receive no access. The original administration access retains its previous login conditions and remains a protected admin. Admins cannot revoke their own role; concurrent role changes also check authorization immediately when writing.

At `/einstellungen`, signed-in email and Google accounts can edit their display name. Account details show email address, login method, and verified status. A separate password section starts the existing flow through an email link; Google accounts are directed to Google's password management. Account deletion is in a separate section with the existing identity and administration protection checks. The local loopback preview offers a seed admin, email account (`?vorschau=email`), and Google account (`?vorschau=google`) with fictional data. Name changes, password link, password form, and account deletion are simulated exclusively in page state; account, email, and session APIs are untouched. The preview can be reset after a simulated deletion. Email registration requires a display name of 2–80 characters. New and edited reviews use only the server-verified account name; a separate review name cannot be entered. Missing or invalid names on older or Google accounts appear as the localized label “Anonym” (“Anonymous”), never the email address as a fallback. Previously submitted review names remain unchanged when only the account name changes and are adopted on the next review edit. Self-deletion requires a fresh password check or a server-verified Google OAuth flow and entry of the localized confirmation `KONTO LÖSCHEN`. Account targets come exclusively from the verified session. Delegated admins, the original administration access, and confirmed legacy administrative links are protected against self-deletion.

At `/bewertungen`, signed-in accounts see their own submissions on a standalone page with review status, private evidence, and existing edit, supplement, and delete actions. The account menu, completion links, and new moderation notifications use this page. Old links with `/?besuche=1` or `einreichung` lead there while preserving the language and a valid submission target. Direct visits, reloads, and browser navigation require no open landing dialog. Guests and expired sessions receive the existing login path with a safe return destination. The page is `noindex,nofollow` in DE/SQ/EN, with no private language alternates; permissions and evidence storage remain on existing APIs.

Migration `0009` adds the private D1 table `auth_account_deletions`; migration `0010` adds the upload inventory table `evidence_uploads`. Existing data requires no transfer. Both migrations must be applied before publication. A hashed deletion key is initially valid for ten minutes and becomes a continuation permission valid for seven days when deletion starts. It does not permit ordinary login. Partial failures preserve the block and ownership link for retries; cleanup also removes orphaned and older evidence files. After expiry, the administrative deletion function can help; incomplete local cleanup appears in user administration even if the auth service has already removed the account. Ongoing evidence uploads are registered before writing. Private file contents replace their empty R2 reservation only with an atomic ETag condition. If deletion removes the reservation, a late upload can no longer store private file contents. Orphaned reservations and failed compensating deletions remain cleanable without permanently blocking account deletion. No new Supabase tables or email templates are needed.

At `/betriebe`, signed-in accounts see their assigned workshop profiles; multiple businesses per account are supported. The localized “Profil bearbeiten” (“Edit profile”) action opens a dialog with a fixed header, scrollable form, and fixed actions. The standalone `/antraege` page shows pending and decided ownership requests and profile changes. Both pages have equal standing in the account menu. Old links to `/betrieb` and `/betrieb/beanspruchen` redirect to the new addresses with their parameters preserved.

“Werkstattprofil beanspruchen” (“Claim workshop profile”) is a standalone page at `/betriebe/beanspruchen?werkstatt=…`, reachable from the public workshop profile. Applicants select their relationship to the business: owner, managing director, authorized representative, or another relationship with their own explanation. The selected relationship is stored as a private declaration; another relationship requires at least 40 characters. Each new request requires 1–5 documents as PDF, JPG, or PNG, up to 5 MiB each and 10 MiB total. Only applicants and administration can download them. Direct visits without a valid profile show a link to the workshop finder. After successful submission, the confirmation leads to “Meine Betriebsanträge” (“My business requests”).

Administration approves or rejects business requests at `/verwaltung/betriebe` with an appropriate reason selection. Review notes also offer standard reasons and a custom explanation for “Anderer Grund” (“Other reason”). These notes stay private. Each profile has at most one confirmed assignment; competing requests cannot grant additional rights. Confirmed business access grants no admin role and permits only change drafts for owned profiles. Contact details, services, and description become public only after renewed approval. Name, location, sources, review date, and approval status remain protected. Changed phone numbers require the existing strict Google check; preparing that check does not overwrite the public assignment. An intervening profile change prevents adoption of an old draft. The overview automatically reloads after changes; retry is offered only for loading errors.

D1 migration `0011` adds `workshop_claims`, `workshop_owners`, and `workshop_changes`. It requires no transfer of existing data and must be applied before publication. Migration `0014` adds nullable file metadata for private ownership evidence. Existing textual evidence and evidence links are preserved; no data transfer is needed. Administration must check evidence independently. Uploads use existing private R2 storage and the upload inventory; account deletion also cleans up these documents. Account deletion removes private requests, drafts, and business assignments, including confirmed legacy links, while preserving independently maintained catalogue profiles. Approved business changes must be exported like admin changes before the next catalogue import.

When a review is approved or additional evidence is requested, moderation stores a durable event in `review_notifications` together with the status change. The message contains only the status and a link through login to the person's own submission; names, review text, vehicle details, private evidence, and review notes are not sent. Recipients come from the server-verified account of the selected auth provider; confirmed legacy links are considered. Missing verified addresses and blocked accounts remain traceable in private delivery events.

Default delivery continues to use the existing Resend service and verified domain `auth.riparim.com`. `RESEND_API_KEY` is a server-side secret from the existing protected project access; `TRANSACTIONAL_EMAIL_FROM` is the sender, for example `Riparim <no-reply@auth.riparim.com>`. The appropriately bound auth admin key is required to verify confirmed account addresses; Supabase retains the compatible `SUPABASE_SECRET_KEY` path. Shared DE/SQ/EN email copy lives in `lib/email-content.ts`; `lib/notifications/email.ts` renders review emails with a subject and HTML only, including language, title, and a labeled link. `text: ""` disables Resend's automatic plain-text generation. The first attempt uses only the validated preference of the verified recipient; missing or invalid values remain German. Stored retries preserve their original language and every delivery byte even after preference or release changes. This also applies to historical payloads that still contain a plain-text part.

Confirmation/recovery subjects and HTML templates live in
`lib/auth/email-templates.ts`. The application continues to generate the stable
callback with `?locale=…&weiter=…`. Separate provider adoption after a
verified main release is documented in [email activation](docs/customer-flow-qa.md#localized-email-templates-and-provider-activation-issue-52).
There is no new email platform, migration, or auth hook infrastructure.

The reproducible provider switch with protected app/file backup, a fresh Node restore, and a return path that preserves data is documented in [provider-exit.md](docs/provider-exit.md).

Portable Node operation also supports SMTP through `EMAIL_TRANSPORT=smtp`, `SMTP_URL`, and `SMTP_SECRET_ORIGIN`. Migration `0017_mail_transports.sql` adds transport binding, frozen MIME bytes, and a durable SMTP start marker. Uncertain SMTP handoffs are not resent, including on administrative retry. Configuration, TLS verification, and the controlled switch procedure are documented in [mail-transports.md](docs/mail-transports.md). The Worker retains HTTP delivery through Resend.

Migration `0012` adds the private delivery table; historical moderation decisions are not notified retroactively. The initial delivery attempt is awaited immediately after the saved moderation decision. There is no periodic email job. On failure, protected administration allows at most five manual retries after waits of 1, 5, 15, 30, and 60 minutes. Limits and waiting times are checked atomically on the server. The overview updates after an action or on explicit request; it does not poll. Provider errors do not revoke successful moderation. Uncertain SMTP handoffs and expired Resend idempotency windows remain blocked against uncontrolled resending. Stored events and payload bytes are preserved. The release removes the previous cron with an explicitly empty cron list; no new migration is required.

Every decision has a unique idempotency key per submission and revision. After the first attempt, recipient and message contents remain unchanged. Retries conservatively end after 23 hours because [Resend stores keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys); uncertain older events require inspection at the delivery service. A changed recipient or delivery-key configuration prevents an unsafe retry. After a successful handoff, the frozen address/message contents are removed from the local table. The localized status “An Versanddienst übergeben” (“Handed to delivery service”) does not confirm final delivery. Deleting the submission or account removes associated local delivery events.

The portable development server offers a local ChatGPT test identity at `/signin-with-chatgpt?return_to=/`. This simulation applies only on loopback and is excluded from the production build. Do not use it as a substitute for testing real login.

## Portable Node server

In addition to the Cloudflare Worker, the same app code can run with Next.js on Node.
`npm run build:node`, `npm run db:migrate:node`, and
`npm run start:node -- --port 5174` use SQLite and a private local
blob file store. Configuration, backup, manual delivery, and limits
are documented in [docs/node-runtime.md](docs/node-runtime.md). The existing
Cloudflare default remains in place. Verified prebuilt Node packages and the host-local installation/deployment procedure are documented in [docs/node-deployment.md](docs/node-deployment.md).

Internal account IDs are separated from external login accounts through a private,
additive identity mapping. Existing ownership keys and file paths
are preserved. Rollout, verified provider mapping, preservation of blocks, and the return path
are documented in [docs/account-identities.md](docs/account-identities.md).

## Database and checks

Migrations live in `drizzle/`. After schema changes:

```sh
npm run db:generate
```

For a new local development database, first build the Sites Worker and apply SQL migrations in ascending order. Do not rerun already applied migrations:

```sh
BUILD_TARGET=sites npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_handy_black_queen.sql
```

Repeat the last command for each migration file that is still pending.

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

`npm test` checks the review flow, ownership rights, user administration, catalogue filters, Google sessions, and OAuth callbacks with isolated SQLite/R2/provider fixtures. It sends no real emails and changes no production data.

On Linux, macOS, and WSL, independent test suites run concurrently in four separate
Node processes. `TEST_CONCURRENCY=1 npm test` retains serial
diagnosis; values from 1 to 4 are allowed. Use WSL on Windows: native
Windows execution is rejected before starting suites because it lacks safe
cleanup through POSIX process groups.
Logs include their suite name. The i18n check runs first; failure or
cancellation stops running suites before the shared test directory is removed.
Resource checks and runtime measurements are documented in
[the test runner documentation](docs/test-suite-concurrency.md).

`npm run build` also checks generated browser code: the actual bundled link must trigger navigation and continue to work after a failed prefetch. The check runs for Cloudflare and Sites builds with isolated browser/network fixtures. After an existing build, it can be repeated separately with `npm run test:client-build`.

Additional live and browser checks are documented in [docs/customer-flow-qa.md](docs/customer-flow-qa.md). The recorded inventory review in `data/catalogue-review-2026-10-04.json` lists independent sources and deferred location conflicts.

GitHub Actions checks the catalogue, tests, TypeScript, lint, and Worker build on pull requests. After a squash merge into `main`, `semantic-release` creates a versioned GitHub Release for relevant Conventional Commits and publishes its verified Worker artifact to Cloudflare. Details and required production secrets are documented in [docs/releases.md](docs/releases.md).

## Publication

Publication at `https://riparim.com` takes place exclusively through the **Release** workflow from merged `main`. `wrangler.jsonc` is the source for the target account, resources, the two owned custom domains, and runtime variables. The GitHub environment `production` allows only `main` and stores deployment/application secrets. Open PRs are not published.

Data migration and the production cutover have been [verified and accepted](docs/domain-cutover-2026-10-05.md). The [overall completion record](docs/release-handover-2026-10-05.md) maps evidence to acceptance criteria. The previous OpenAI Site has been [publicly retired](docs/sites-retirement.md); owner access, data, and versions remain retained securely. `.openai/hosting.json` identifies this historical project for the verified Sites archive and local bindings; it is not a production deployment target of the regular pipeline. Native Sites tokens are not used for CI. The owned Cloudflare Worker removes native Sites identity headers at ingress. A local Worker can be checked with `npm start -- --port 5175`.
