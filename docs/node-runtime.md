# Portable Node operation

Alongside the existing Vinext/Cloudflare build, Riparim can run the same App
Router code with the already installed Next.js on an ordinary Node server.
There is no new framework or storage dependency. Cloudflare remains the default
deployment target. The [Node release/deployment path](node-deployment.md) installs
prebuilt verified main releases on a single host without rebuilding the app.

## Build, migrations and startup

Node.js 24 from 24.10 is recommended; supported versions are in `package.json`.
The second operating path uses built-in `node:sqlite`. Its API remains
experimental in Node 22/24. Installation and build need locked development
dependencies.

```sh
npm run install:ci
npm run build:node
cp .env.example .env
export RIPARIM_DATA_DIR="$PWD/.riparim"
export SITE_ORIGIN=http://127.0.0.1:5174
npm run db:migrate:node
npm run start:node -- --port 5174
```

The build produces `.next/` and `.node-runtime/command.mjs`.
A small `node:http` launcher passes requests to existing Next.js.
Next's Webpack build replaces `lib/runtime/env` with the Node adapter and the
Worker SMTP stub with the small Node delivery adapter. Pages and APIs use the
same business rules and SQL queries as the Worker. The `skipProxyUrlNormalize`
option preserves the original request origin: otherwise internal locale rewrites
from `127.0.0.1` to `localhost` can be executed as external self-requests.
The canonical `/de` redirect remains. The shared availability check decides
before streaming: missing, invalid and unpublished workshop profiles receive
HTTP 404 for HTML, RSC navigation and HEAD. Private drafts remain hidden.

Behind an HTTPS reverse proxy, `SITE_ORIGIN` must be the public HTTPS origin.
The launcher validates HTTP/HTTPS without credentials, path, query or fragment
and creates Next's public request metadata from it. Socket bind host and port
remain separate. Incoming Host and Forwarded-Host/-Proto/-Port headers do not
override this configuration. The reverse proxy handles TLS and public host
redirects. The server binds only to loopback by default; `--hostname` and `--port`
can be passed through `npm run start:node -- ...`. Launcher and commands load
`.env` with Node's `--env-file-if-exists`. Secrets remain server-side and belong
neither in Git nor build artifacts.

For IP limits, the Node adapter uses the verified socket address from an
`AsyncLocalStorage` context. Launcher and Next bundle share only the context
container; concurrent requests keep separate addresses. Freely supplied
`cf-connecting-ip`, `X-Forwarded-For` or internal fake headers establish no new
rate limit scope. The Cloudflare adapter continues using the header supplied
by the owned edge.

When a reverse proxy is present, `RIPARIM_TRUSTED_PROXIES` contains only its
explicit IP addresses, comma-separated. Only a socket peer on this list may
provide a valid single `X-Real-IP`. The proxy must **overwrite** this header with
the actually connected client address; forwarding an unverified browser header
does not meet this boundary. IPv4-mapped IPv6 and equivalent IP spellings are
normalized. Missing, ambiguous or invalid forwarded client addresses fall back
to the socket peer. Invalid entries in the proxy allowlist abort startup.
Without an allowlist, all forwarding IP headers are ignored. Start through
`start:node`; direct `next start` provides no socket context and conservatively
uses the shared `unknown` scope.

## Data and private files

`RIPARIM_DATA_DIR` identifies a dedicated writable data directory outside
`public/`. Without configuration, `.riparim/` is used.
It contains two persistent files with mode `0600`:

- `app.sqlite`: application tables from unchanged Drizzle SQL files.
- `files.sqlite`: private document content as blobs with key, ETag, upload time
  and HTTP/custom metadata. This separate file is the local file store,
  not a public download directory.

New directories are created with mode `0700`. The service user needs exclusive
administrative access to the directory. Downloads still go exclusively through
existing APIs with ownership/admin checks and `Cache-Control: private, no-store`.
Sites identity headers establish neither customer nor admin rights in Node
operation, even with missing Auth configuration. Actual login uses the configured
Auth host: Supabase by default, alternatively an explicitly authorized
Supabase-compatible instance or the concrete PocketBase profile according to
[auth-provider.md](auth-provider.md). `AUTH_TRUSTED_ORIGIN`/`AUTH_TRUSTED_PROVIDER`,
`AUTH_ADMIN_KEY` credential bindings and compatible `SUPABASE_SECRET_KEY` values
are also read exclusively from the protected runtime environment in the Node path.

`db:migrate:node` runs SQL files in ascending order. `riparim_node_migrations`
stores filename, SHA-256 and time. Each migration and receipt form a transaction.
Retries skip identical applied files; modified applied files cause an abort.
There is no new Drizzle migration and no automatic data transfer from D1.
Initial catalogue transfer still uses the existing import. A verified complete
D1/R2 export can be transferred into a new Node directory with the small offline
restore. Process, safe retry boundary and fresh reverse transfer are in
[provider-exit.md](provider-exit.md).

SQL batches remain atomic. Private file contents and their ETag share one
blobstore row: conditional uploads update them only if the reservation with
that ETag still exists. Account deletion removes reservations; delayed uploads
cannot then leave content. SQLite serializes this operation across multiple
local connections too. Metadata lists load no document contents. Invalid keys
with absolute paths, traversal segments or backslashes are rejected.

The path is intended for **one host with local persistent storage**.
A shared SQLite file on network drives or multiple hosts is not an accepted
operating path. Before backup or transfer, stop all app processes and the
delivery job, then back up the complete data directory, including any SQLite
WAL/SHM files. Both databases belong in a backup; `files.sqlite` alone contains
no ownership rights. Restore into a private directory with processes stopped,
then check migrations and customer flows. Online backups require a SQLite
backup method rather than simple copies of active files.

## Background delivery

The moderation route awaits its first send attempt. The persistent event survives
partial failures. There are no fire-and-forget promises or periodic email service.

```sh
npm run notifications:node -- riparim-review-<submission>-revision-<revision>
```

This operator command retries only the named event and awaits the attempt.
It respects the same lease, safe idempotency window, waits of 1/5/15/30/60 minutes
and limit of one initial send plus five manual retries. Data directory, `.env`
and release directory remain identical. The protected notification API offers
the same individual action; there is no batch processing. Stop and disable
existing systemd email timers or crons before activating this release.

## Acceptance

`npm test` registers the second operating path:

- `node-storage`: persistence, atomic batch rollbacks, unchanged migrations,
  private files, metadata, pagination and conditional writes.
- `node-evidence`: actual review/download/account-deletion logic with synthetic
  accounts and real Node storage; foreign downloads are rejected, account
  deletion during upload cleans up content and inventory.
- `node-runtime`: actual Next production build and started HTTP server with
  synthetic public and private profiles; DE/SQ/EN pages, APIs, private access
  denial, forged Sites admin headers, actual socket IP limits, parallel trusted
  proxy clients and configured HTTPS origins, and both executable migration/
  outbox commands.

These checks change no live providers and send no actual emails. The test builds
Node itself; `npm run test:node` repeats HTTP acceptance individually.
Existing Cloudflare/Sites builds and release packages remain required checks.

API foundations: [Node SQLite](https://nodejs.org/api/sqlite.html),
[Next server](https://nextjs.org/docs/app/guides/custom-server),
[AsyncLocalStorage](https://nodejs.org/api/async_context.html) and
[proxy URL normalization](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#advanced-proxy-flags).
