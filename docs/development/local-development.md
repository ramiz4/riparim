# Local development

Use Node.js 24 LTS and npm. Run in your [task checkout](../../CONTRIBUTING.md):

```sh
npm run install:ci
npm run dev
```

Open `http://127.0.0.1:5174`. Startup applies pending local migrations and prepares
curated workshop data. It needs no build, Cloudflare login or production credentials.
Each worktree keeps its own database and uploads in `.wrangler/state`.
With valid migration history, existing edits and confirmed hours are preserved.
Older databases with application tables but no migration history are automatically
archived with all D1 data and R2 uploads in a private `.wrangler/state-backup-*`
directory. Startup prints that path and announces fresh catalogue defaults;
previous local accounts, visits and edits stay in the backup, not the new database.
Normal restarts do not archive again. See [local recovery](local-data-recovery.md)
for backup recovery. Failed migrations or seeds never trigger this archive flow.

## Useful options

```sh
npm run dev -- --port 5180
npm run dev:setup
```

`dev:setup` prepares without starting the server. The port determines the local
origin unless `SITE_ORIGIN` overrides it. Optional integrations use `.env.example`;
configure them only when needed. Supported runtimes are in [package.json](../../package.json).

For local admin access, set `REVIEW_MODERATOR_EMAIL=seedy@sites.test` in ignored
`.dev.vars`, then use “Als Seedy anmelden” at `/anmelden` or `/dev/anmelden`.
The latter accepts a validated internal `?weiter=…`. Account previews use
`?vorschau=email` or `?vorschau=google`; the portable preview also offers
`/signin-with-chatgpt?return_to=/`. These loopback-only simulations do not test real login.

## When setup fails

Read the named phase and log under `.sites-runtime/local-dev`, then fix that cause:

| Problem                              | Next step                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Missing dependency/runtime           | Use supported Node and rerun `npm run install:ci` here.                                    |
| Migration or seed failure            | Preserve state; fix the reported cause and rerun `dev:setup`. Applied SQL stays unchanged. |
| Another preparation is active        | Wait; never remove a live process's lock.                                                  |
| Unknown history or an abandoned lock | Follow [local recovery](local-data-recovery.md).                                           |
| Port occupied                        | Choose another port or stop its owner.                                                     |

Create schema changes with `npm run db:generate`; never replay migration SQL manually.
Keep env files, databases, uploads and backups ignored and private.

## Commit hook setup

After an install with `--ignore-scripts`, run `npm run prepare`. CI (`HUSKY=0`),
production installs or missing Git/Husky skip hooks. Hook setup is per worktree;
if it reports shared `core.worktree`, move that setting into the primary worktree's
configuration before retrying. See [the installer](../../.husky/install.mjs) for details.
