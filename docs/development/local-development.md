# Local development

Use Node.js 24 LTS and npm (`package.json` defines support). Go 1.27.1 is needed
for full tests/auth email export, not startup; use `RIPARIM_GO_BINARY` if off PATH.

```sh
npm run install:ci
npm run dev
```

Open `http://127.0.0.1:5174`. Startup checks prerequisites/schema/history, applies
pending Drizzle migrations, seeds curated catalogue/contact/email/hours defaults,
then starts Vinext. No build, Cloudflare login or production credentials are needed.

```sh
npm run dev:setup
npm run dev -- --host 127.0.0.1 --port 5180
```

`dev:setup` prepares and exits. Port sets the origin unless `SITE_ORIGIN` overrides
it; keep overrides aligned. Checkout-managed execution profiles retain their preview.
Optional live auth/email/Google integrations use `.env.example` and their area guides.

## State and failures

D1 migrations, seed and Vite share checkout-local `.wrangler/state` and `DB`/`BUCKET`
bindings. Worktrees have independent data/uploads; preparation explicitly targets
local state even with production credentials. SQL in `drizzle/` is authoritative;
Wrangler records applied filenames in `d1_migrations`. Earlier successful migrations
can survive a later failure; fix the cause and rerun. Generate schema changes with
`npm run db:generate`; applied SQL remains immutable and is never manually replayed.

Seed protects newer profile edits, confirmed/modified hours and suppressed imports.
It adds no customer accounts, visits, reviews or evidence, and never resets after failure.
Read the reported phase/cause/log under ignored `.sites-runtime/local-dev`:

| Failure                                        | Action                                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| Missing dependency/runtime                     | Use supported Node; rerun `npm run install:ci` here.    |
| Migration/seed validation                      | Fix the named cause; preserve data and applied history. |
| Preparation already active                     | Wait; never remove a live process's lock.               |
| Unknown/incomplete/divergent schema or history | Follow [local data recovery](local-data-recovery.md).   |
| Port occupied                                  | Choose another port or stop its owner.                  |

SIGINT/SIGTERM abort preparation without server readiness. After a forced kill,
`.wrangler/state/.riparim-prepare.lock` may remain: read `owner.json`, inspect its
PID (`ps -p <pid> -o pid=,command=`), and stop this checkout's dev/setup/Wrangler
processes. PID reuse alone proves nothing. Remove only an explicitly verified
abandoned lock; retain it when ownership is uncertain. Normal shutdown releases it.

## Local identities and hooks

On loopback only, `/anmelden` offers “Als Seedy anmelden”; `/dev/anmelden` accepts a
validated internal `?weiter=…`. Ignored `.dev.vars` may set
`REVIEW_MODERATOR_EMAIL=seedy@sites.test` for local admin access. Account-settings
previews use `?vorschau=email`/`google` and simulate edits/deletion only in page state.
The portable preview's `/signin-with-chatgpt?return_to=/` is also a local simulation.
These entry points cannot verify real provider login; use [customer QA](customer-flow-qa.md).

Install activates Husky per worktree without changing others' hooks. After
`--ignore-scripts`, run `npm run prepare`. CI (`HUSKY=0`), production installs,
missing Git metadata/Husky skip setup. Worktree configuration enables
`extensions.worktreeConfig`; if shared `core.worktree` exists, first move it into the
primary worktree's config. Use the local Prettier version for optional editor formatting.
Keep env files, databases, uploads, backups and build output ignored and private.
