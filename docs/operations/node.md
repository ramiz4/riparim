# Node operations

Run the existing app on **one host with local persistent SQLite storage**.
Cloudflare remains the default. Network filesystems and multiple hosts are unsupported.
Use Node 24 from 24.10 for production; `node:sqlite` remains experimental.

## Local build

```sh
npm run install:ci
npm run build:node
cp .env.example .env
export RIPARIM_DATA_DIR="$PWD/.riparim"
export SITE_ORIGIN=http://127.0.0.1:5174
npm run db:migrate:node
npm run start:node -- --port 5174
```

The build creates `.next/` and `.node-runtime/`. Start through `start:node` or the
packaged launcher; direct `next start` bypasses the request context.
The same routes, authorization and migrations serve both runtimes.
Builds reject private `.env*` files; keep them outside the checkout while building.

## Persistent storage and proxy

`RIPARIM_DATA_DIR` defaults to `.riparim/`; keep it outside `public/`.
Both `app.sqlite` (application data) and `files.sqlite` (private bytes/metadata)
are required. Directories use `0700`, files `0600`; only the service operator has
administrative access. Downloads still require server-side ownership/admin checks.
Migrations record filename/SHA-256 transactionally; a modified applied file aborts.

Before backup/transfer, stop the app and every writer; copy both databases and any
WAL/SHM files. Restore privately with processes stopped. Active copies require a
SQLite backup method. Initial production transfer follows [provider switching](provider-switch.md).
The offline restore tool runs on the administration machine, not inside the release package.

Set `SITE_ORIGIN` to the exact public HTTPS origin behind a reverse proxy.
TLS and canonical host redirects belong to the proxy. The launcher binds loopback;
`--hostname`/`--port` change the socket address, never the trusted origin.
Host/Forwarded headers cannot override it. `RIPARIM_TRUSTED_PROXIES` accepts explicit
proxy IPs only; that proxy must overwrite `X-Real-IP` with the connected client's IP.
Without a matching peer, forwarded addresses are ignored; invalid allowlist entries
abort startup. Secrets remain in protected runtime configuration.

## Install a published release

The host needs Node, npm and POSIX `tar`, with a dedicated service user.
It installs the verified prebuilt Node pair; no Git checkout or target build.
The installer checks publication, stable tag, main ancestry, successful verification,
checksum, target and archive safety before installing locked production dependencies.

Bootstrap: on the administration machine, verify the GitHub release/provenance and
archive SHA-256, extract `node/.node-runtime/install.mjs` from that exact archive,
and securely place it at `/opt/riparim-tools/install.mjs` (`0700`) on the host.
Never execute an installer from an unverified archive. One-time empty-host setup
(never overwrite an existing `runtime.env`):

```sh
install -d -m 0700 /opt/riparim /opt/riparim/shared /opt/riparim/shared/data
install -m 0600 /dev/null /opt/riparim/shared/runtime.env
node /opt/riparim-tools/install.mjs prepare --root /opt/riparim --tag vX.Y.Z
```

Replace the tag with an actual release. Privately set `SITE_ORIGIN`, `PORT`, proxy
IPs and required Auth/Google/mail values in `shared/runtime.env`. The installer
fixes the data path to `shared/data`; configuration/data stay outside `releases/`.
Provide any required read-only `GITHUB_TOKEN` only to the installer environment;
it must reach neither npm, service processes, argv nor logs.
Preparation failure removes staging and leaves `current` unchanged.

## Service, update and code rollback

Example `/etc/systemd/system/riparim.service` (adjust the Node path):

```ini
[Unit]
Description=Riparim Node server
After=network.target
[Service]
User=riparim
Group=riparim
WorkingDirectory=/opt/riparim/current
Environment=RIPARIM_DATA_DIR=/opt/riparim/shared/data
Environment=NEXT_TELEMETRY_DISABLED=1
ExecStart=/usr/bin/node --env-file=/opt/riparim/shared/runtime.env .node-runtime/server.mjs
Restart=on-failure
UMask=0077
[Install]
WantedBy=multi-user.target
```

Before activation, verify recovery of a fresh backup with all writers stopped.
`--stopped` confirms that condition; the installer controls no host services.

```sh
sudo systemctl stop riparim.service
node /opt/riparim-tools/install.mjs activate --root /opt/riparim --tag vX.Y.Z --stopped
sudo systemctl start riparim.service
curl --fail --silent http://127.0.0.1:3000/api/session
curl --fail --silent http://127.0.0.1:3000/en/workshops > /dev/null
```

Activation rechecks prepared bytes, migrates and smoke-tests before atomically
switching `current`. Failure preserves old code; successful migrations remain.
HTTP checks do not replace domain/login/private-file acceptance.
For a schema-compatible previous published release, prepare it, stop writers and
use `rollback --root /opt/riparim --tag vPREVIOUS --stopped --schema-compatible`.
Rollback changes code only and runs no old SQL; prefer a reviewed forward fix.
Remove orphaned `.deployment-lock` only after ruling out a running installer.

Disable old email timers/crons. A single manual retry from the active release uses
`node --env-file=/opt/riparim/shared/runtime.env .node-runtime/command.mjs notifications <event-id>`;
[mail limits](mail-transports.md) still apply. Auth/provider changes need [their own procedure](auth-provider.md).
Tests: `npm run test:node` and `npm run test:node-release` use isolated storage/accounts,
exercise real HTTP/package operations and do not send live email.
