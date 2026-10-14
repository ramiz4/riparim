# Riparim

Find and contact workshops in Kosovo at [riparim.com](https://riparim.com).
Reviews are published after moderation; visit evidence stays private.

React, TypeScript and Vinext run on Cloudflare Workers with D1/private R2.
A portable Node build uses Next.js, SQLite and private local files.
Supabase is the default auth provider; PocketBase is an alternative adapter.

## Run locally

Use Node.js 24 LTS and npm; supported versions are in `package.json`.
Full tests and auth email export also need Go 1.27.1.

```sh
npm run install:ci
npm run dev
```

Open `http://127.0.0.1:5174`. Startup prepares local migrations and curated defaults;
no build or provider credentials are required. Each worktree keeps its own D1/R2
state. Optional integrations use `.env.example` placeholders.

## Work on the project

| Task                              | Guide                                                      |
| --------------------------------- | ---------------------------------------------------------- |
| Setup, ports or database recovery | [Local development](docs/development/local-development.md) |
| Checks and formatting             | [Testing](docs/development/testing.md)                     |
| Git, commits and PRs              | [Contributing](CONTRIBUTING.md)                            |
| Agent work                        | [Agent rules](AGENTS.md)                                   |
| Architecture, data and operations | [Documentation](docs/README.md)                            |

Production adopts only verified GitHub Releases from merged `main` through the
release workflow. See [releases](docs/operations/releases.md).
