# Node operations

Use Node 24 (24.10 or later), one host with persistent local SQLite storage,
and a dedicated service user. Network filesystems/multiple hosts are unsupported;
`node:sqlite` remains experimental. Cloudflare is the default deployment.

## Run locally

```sh
npm run install:ci
npm run build:node
cp .env.example .env
export RIPARIM_DATA_DIR="$PWD/.riparim"
export SITE_ORIGIN=http://127.0.0.1:5174
npm run db:migrate:node
npm run start:node -- --port 5174
```

Build before creating private `.env*` files; builds reject them. Use `start:node` or
the packaged launcher because direct `next start` bypasses request context.

## Prepare the host

1. Choose a [verified release](releases.md). Verify its Node archive/provenance SHA-256
   before extracting `node/.node-runtime/install.mjs`; securely place that installer
   at `/opt/riparim-tools/install.mjs` (`0700`). The host needs Node, npm and POSIX `tar`.
2. Create the empty-host directories below. **Never overwrite existing `runtime.env`.**

   ```sh
   install -d -m 0700 /opt/riparim /opt/riparim/shared /opt/riparim/shared/data
   install -m 0600 /dev/null /opt/riparim/shared/runtime.env
   node /opt/riparim-tools/install.mjs prepare --root /opt/riparim --tag vX.Y.Z
   ```

3. Replace the tag with the actual release. Privately configure `SITE_ORIGIN`, `PORT`,
   proxy IPs and Auth/Google/mail in `shared/runtime.env`. The installer fixes data to
   `shared/data` and installs locked production dependencies without a target build.
   Any read-only `GITHUB_TOKEN` belongs only in the installer environment, never npm,
   service processes, argv or logs. Failed preparation leaves `current` unchanged.
4. Set the exact public HTTPS `SITE_ORIGIN`. The proxy owns TLS/canonical redirects
   and must overwrite `X-Real-IP` with the connected client’s IP. `RIPARIM_TRUSTED_PROXIES` lists explicit proxy IPs;
   untrusted forwarded headers are ignored. Bind the launcher to loopback by default;
   socket options do not change the trusted origin.

Keep data outside `public/` and releases. Both `app.sqlite` and `files.sqlite` are
required, with `0700` directories/`0600` files. Only the service operator may access
storage; downloads remain server-authorized. Stop all writers before copying both
and any WAL/SHM files; active copies need a SQLite backup method. Restore while stopped.
Initial transfer follows [provider switching](provider-switch.md); its offline restore
runs on the administration machine, outside the package.

## Start or update

Example `/etc/systemd/system/riparim.service`; adjust the Node path:

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

Verify fresh backup recovery, then stop all writers. `--stopped` confirms this;
the installer does not control services.

```sh
sudo systemctl stop riparim.service
node /opt/riparim-tools/install.mjs activate --root /opt/riparim --tag vX.Y.Z --stopped
sudo systemctl start riparim.service
curl --fail --silent http://127.0.0.1:3000/api/session
curl --fail --silent http://127.0.0.1:3000/en/workshops > /dev/null
```

Activation verifies/migrates/smoke-tests before switching `current`. Failed activation
preserves old code, but successful migrations remain. Check real domain/login/private
access separately. Never modify applied migrations. Remove orphaned `.deployment-lock`
only after ruling out a running installer.

For a schema-compatible previous release, prepare it and stop writers, then use
`rollback --root /opt/riparim --tag vPREVIOUS --stopped --schema-compatible`.
Rollback changes code only; prefer a reviewed forward fix.

Disable old mail timers/crons. One manual retry from the active release is
`node --env-file=/opt/riparim/shared/runtime.env .node-runtime/command.mjs notifications <event-id>`;
follow [mail limits](mail-transports.md). Provider changes use [Auth operations](auth-provider.md).
