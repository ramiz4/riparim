# Install and operate Node releases

Alongside existing Cloudflare/Sites archives, a verified Semantic Release includes
`riparim-node-vX.Y.Z.tar.gz` and `riparim-node-vX.Y.Z.json`. The Node package
contains the prebuilt Next server and frontend, our HTTP launcher, migrations,
outbox command, installer and production manifest/lock.
The target has no Git checkout or app build. The installer runs only
`npm ci --omit=dev --ignore-scripts`; Node.js **24 from 24.10**, npm and POSIX
`tar` are required. Linux/systemd is the operating example below;
the host-local installer needs no hosting provider API.

## Completed hosting evaluation

Oracle Always Free was evaluated for Riparim on October 11–12, 2026 and rejected
as a hosting target.

## Publication and target selection

CI verifies and packages all three targets from the same unchanged commit.
Semantic Release on merged verified `main` publishes all six assets.
The `DEPLOYMENT_TARGET` repository variable may be `cloudflare` or `node`.
Without the variable, Cloudflare is used. Any other value aborts before
publication. For `node`, no Cloudflare deployment job starts;
Cloudflare secrets are not required. The Node package is then installed on the
chosen host. There is no new SSH/cloud orchestration. This issue does not switch
existing production.

Old complete publications with four assets remain retryable for the previous
Cloudflare/Sites path. New publications carry the `riparim-release: node-v1`
marker in release text and need all six assets. A Node host always needs the
complete Node pair. The installer checks GitHub publication, stable tag, tag
commit, main ancestry, the successful verification job of this main release
run, target type and SHA-256. A later Cloudflare deployment failure does not
prevent use of the already verified Node package. Drafts, open branches,
arbitrary local builds and dangerous archives are rejected.
GitHub is the publication/trust source; this is no additional cryptographic
signature from independent maintainers.

## Prepare the host once

Use a dedicated service user. `/opt/riparim` belongs exclusively to it and has
mode `0700`. Transfer existing data through the [provider switch](provider-exit.md);
an empty migrated database does not replace account/file transfer.
The existing `restore-node` CLI remains an administrative tool and is not part
of the Node runtime package. Transfer the protected export on the administration
machine with transfer/restore tools from the verified release commit into a
fresh private directory, then perform its data/file checks. With processes
stopped, securely transfer **both** SQLite files and any remaining WAL/SHM files
from that verified directory to `/opt/riparim/shared/data`. Then run the Node
release's migration/HTTP/customer checks. The target host needs neither a source
checkout nor build/restore dependencies.

The executable installer is at `node/.node-runtime/install.mjs` in the published
archive. An administrator copies it once from the verified main release into
a protected tool directory. For example, on the administration machine download
the Node pair with `gh release download vX.Y.Z --repo ramiz4/riparim --pattern
'riparim-node-vX.Y.Z.*'`, verify GitHub release and provenance, compare its archive
SHA-256, then read only the named installer with `tar -xOzf
riparim-node-vX.Y.Z.tar.gz node/.node-runtime/install.mjs > install.mjs`.
Place this trusted tool file on the host at `/opt/riparim-tools/install.mjs`
with mode `0700`. Do not run an unverified installer from an unrelated archive.
Bootstrap performs no app compilation on the target.

```sh
install -d -m 0700 /opt/riparim /opt/riparim/shared /opt/riparim/shared/data
install -m 0600 /dev/null /opt/riparim/shared/runtime.env
```

Then edit `runtime.env` privately. Minimal example:

```dotenv
SITE_ORIGIN=https://your-domain.example
PORT=3000
RIPARIM_TRUSTED_PROXIES=127.0.0.1
REVIEW_MODERATOR_EMAIL=moderator@example.invalid
```

Transfer actual required Auth, Google and delivery values from protected
configuration. Allowed fields match [Node operation](node-runtime.md), plus
`PORT`. No GitHub/Cloudflare deployment tokens in this file.
The installer forces `RIPARIM_DATA_DIR` to `/opt/riparim/shared/data`; if specified,
it must exactly match this absolute path. Both SQLite files, WAL/SHM and
configuration are outside `releases/` and `current`. Updates do not overwrite
them. Keep configuration files at `0600`, data directories at `0700`.
A private repository needs a GitHub token to read releases and Actions
verification jobs; provide it only as a protected `GITHUB_TOKEN` environment
for the installer. It is not passed to npm or runtime processes and belongs
neither in argv nor service configuration or logs.

## Prepare a release

Run as the service user:

```sh
node /opt/riparim-tools/install.mjs prepare --root /opt/riparim --tag vX.Y.Z
```

The command downloads only the published Node pair, verifies it, extracts into
a separate private staging directory and installs locked production dependencies.
Only successful verification turns it into `releases/vX.Y.Z/node`.
An error removes staging state and leaves `current` unchanged.
Retrying the same release uses only the verified complete inventory.
Prepared application files are compared again with the published archive
during activation.

## Service and manual delivery

TLS and public host redirects are handled by the reverse proxy.
The server binds to loopback. The proxy overwrites `X-Real-IP` and permits only
the configured public host domain; `SITE_ORIGIN` contains the public HTTPS
origin. The explicit proxy IP allowlist and all ownership/origin checks remain
active. `next start` bypasses our request context and is not a startup path.

Example `/etc/systemd/system/riparim.service`:

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

`/usr/bin/node` must be the documented Node 24 version. Services must inherit no
GitHub token. For the service, `runtime.env` contains the port; the user needs
no public port binding. Email attempts are awaited by the moderation route.
No periodic notification service or timer is configured. Stop/disable existing
`riparim-notifications.timer` and `.service` before switching. The operator may
manually retry one stored event with
`node --env-file=/opt/riparim/shared/runtime.env .node-runtime/command.mjs notifications <event-id>`;
server-side limits from [Node operation](node-runtime.md) remain binding.
The installer automatically configures no email service, Auth provider or
reverse proxy.

## Migration, activation and HTTP verification

Before the first production cutover, separately accept domain/TLS, Auth callback,
SMTP and complete data transfer. On every update, stop all writers, then privately
back up both databases, including any WAL/SHM files, and verify recovery.
Deliberate `--stopped` confirms this operator condition; the installer controls
no arbitrary host services.

```sh
sudo systemctl stop riparim.service
node /opt/riparim-tools/install.mjs activate --root /opt/riparim --tag vX.Y.Z --stopped
sudo systemctl start riparim.service
curl --fail --silent http://127.0.0.1:3000/api/session
curl --fail --silent http://127.0.0.1:3000/en/workshops > /dev/null
```

`activate` rechecks release, archive and code, loads only private external
configuration and runs existing migrations. It then briefly starts the prepared
server on a free loopback port and checks the session API; output of this check
process is not logged. Only success activates `current` through an atomic symlink
switch. The command reports the previous code path. A failed migration or HTTP
preflight preserves previous code; already successfully applied additive
migrations remain. No automatic database downgrade. On a failed HTTP/customer
check, keep the service stopped and inspect schema/logs without secrets.
HTTP smoke checks do not replace login, moderation and private download
acceptance on the target domain.

## Code return path preserving data

Prefer publishing a reviewed forward fix. If previously verified code is
compatible with the **current** schema, prepare the previous published release
and activate it after stopping writers again:

```sh
node /opt/riparim-tools/install.mjs prepare --root /opt/riparim --tag vPREVIOUS
sudo systemctl stop riparim.service
node /opt/riparim-tools/install.mjs rollback --root /opt/riparim --tag vPREVIOUS --stopped --schema-compatible
sudo systemctl start riparim.service
curl --fail --silent http://127.0.0.1:3000/api/session
```

Replace `vPREVIOUS` with an actual stable tag. `rollback` switches only code and
runs no old SQL files. New data, accounts, roles, evidence, outbox events and
private configuration are preserved. Restoring an old backup would lose newer
writes and is not a code rollback. Remove unneeded releases in a controlled
manner only after the fallback period ends; `shared/` remains.
Remove an orphaned `.deployment-lock` only after verifying no installation
process still runs.

The operating path remains restricted to one host with local persistent SQLite
storage. No multiple-host/network-drive approval, no Auth protocol change and
no automatic production hosting/domain cutover. The package test starts the
actual HTTP server after removing the original build checkout and checks
frontend bytes, APIs, migration/outbox and data preservation during
update/retry/return.

Sources: [Next custom server](https://nextjs.org/docs/app/guides/custom-server)
(custom server and standalone are not combined), [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci),
[GitHub release API](https://docs.github.com/en/rest/releases/releases),
[GitHub Actions jobs](https://docs.github.com/en/rest/actions/workflow-jobs).
