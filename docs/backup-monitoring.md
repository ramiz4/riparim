# Backup monitoring

**Status on 2026-10-13: Cloudflare monitoring enabled and verified live.**
The operator authorized regular checks every 15 minutes and email alerts.
The main Healthchecks.io check is active; the first automatic cron run and its
success heartbeat were confirmed. Alert/recovery emails and the missing-heartbeat
alert were received in the operator's inbox. The four-minute abort was verified
with isolated delayed test responses on Cloudflare.
Node remains a prepared, disabled alternative.

The shared core in `scripts/lib/backup-monitor-core.mjs` checks the
`Backup: Supabase Auth` and `Backup: Platform` workflows separately through
GitHub metadata. The file paths `auth-backup.yml` and `platform-backup.yml`
identify the workflows; stored alert/incident labels remain
`Supabase Auth Backup` and `Platform Backup`. Display names are separate from
these stable monitor identities.
Checks, alert thresholds, delivery, incident generations and retry keys are
maintained once for both operating modes:

| Operating mode | Schedule and state                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare     | Dedicated `riparim-backup-monitor` Worker, active 15-minute cron and one SQLite-backed Durable Object per repository. Website and D1/R2 bindings remain separate. |
| Node           | Existing `scripts/monitor-backups.mjs` entry point, later a Linux/systemd timer and private JSON file. No additional npm packages required to run it.             |

Cloudflare is active; the Node template remains disabled by default. A separate
Healthchecks.io check monitors missing monitor runs, including Cloudflare or
host outages. Another GitHub schedule would not suffice for this purpose.
State can be transferred between both variants while paused; details follow below.

## Success, alert thresholds and delivery

Only a completed successful main run with the exact, nonempty, published,
unexpired artifact of the current attempt is healthy:
`supabase-auth-<run_id>-<run_attempt>` or `platform-<run_id>-<run_attempt>`.
The publication time must fall between the run's start and completion.
The monitor downloads neither archives nor content and holds no decryption keys.

| State                                                                       | Threshold and rationale                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failure, cancellation, timeout, skip, invalid artifact or disabled workflow | Alert on the next invocation, normally within 15 minutes. Both jobs remain independent.                                                                                                                                     |
| No valid backup                                                             | From 36 hours after the last verified completion: a daily interval of 24 hours plus twelve hours of allowance for GitHub delays. Alert immediately if no backup is verified.                                                |
| Stuck run                                                                   | From 30 minutes after run start. Both backup jobs have a ten-minute limit; the extra 20 minutes tolerate delayed status reports.                                                                                            |
| Queued run                                                                  | From two hours after creation of the current attempt. If a retry lacks an unambiguous timestamp, its first persistently stored observation applies. This gives delayed runner startup more allowance than actual execution. |
| Unchanged incident                                                          | At most one reminder per job per 24 hours. A new valid subsequent backup permits a recovery notice.                                                                                                                         |
| Monitor or delivery unverified                                              | No success heartbeat; error status and exit code 1. Unknown delivery does not count as success.                                                                                                                             |

The email contains only the job name, status, last verified backup time and a
fixed GitHub run or workflow link. No account data, tokens, documents, archive
bytes or keys are sent. Resend acceptance alone does not count as delivery:
`delivered`, `opened` or `clicked` confirm handoff; other states remain unresolved.
Even this provider receipt does not replace an actual receipt test in the
operator's inbox.
[Resend delivery status](https://resend.com/docs/api-reference/emails/retrieve-email).

A healthy heartbeat confirms that checking, state and required delivery work.
It does not mean both backups are healthy: a successfully reported backup failure
may still show the monitor as functioning. JSON output separates `monitorHealthy`
and `backupsHealthy`. API, quota, state and delivery errors cannot produce a healthy
monitor status. Healthchecks receives an empty POST or `/fail`, without job or
account content.
[Pinging API](https://healthchecks.io/docs/http_api/).

The GitHub query considers runs created in the last 32 days. This covers GitHub's
30-day retry window plus the 36-hour fresh-backup threshold. It paginates up to
500 runs and 500 artifacts per run and checks at most 20 successful candidates.
Queued retries also use metadata for their current attempt, at most 20 queries
per job. The original parent run's creation time does not determine their queue
deadline. A missing current timestamp receives a persistently stored observation
deadline, as do further retries beyond the 20 queries. Later status updates and
restarts do not shift this deadline. At most 500 observation entries are allowed
per job; attempts no longer queued are removed.
[Attempt metadata](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run-attempt).
API outages remain verification errors. Exceeded list/candidate limits and
incomplete or invalid responses are verification errors. A new retry of an older
run is checked using its current attempt and artifact.
[GitHub retry window](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).
[Runs](https://docs.github.com/en/rest/actions/workflow-runs),
[artifacts](https://docs.github.com/en/rest/actions/artifacts).

## Costs and required access

Before activation, recheck current allowances and existing usage.
Do not enable paid plans or paid overages.

- **Execution:** No additional host fee only when using an existing host that
  runs continuously. Such a host has not yet been confirmed for Riparim.
  This implementation does not establish that new hardware, a VPS or operating
  it is free.
- **Cloudflare:** The separate Worker can replace the Linux host. Expected usage
  is 96 scheduled checks daily. SQLite-backed Durable Objects are available on
  the Free plan; check account usage, storage, runtime and actual CPU values
  before activation. The checking core runs in the Durable Object; the fronting
  Worker handles triggering and protected access. The Free limit of 50 external
  subrequests still applies: the adapter limits each check to 45 external calls,
  including delivery and heartbeat, and reserves one call for reporting failure.
  Reached limits remain errors, never a healthy status. Node retains its higher
  query limit. External checks have a four-minute deadline and a separately
  bounded failure heartbeat. Concurrent checks are coalesced; the internal
  operations queue is bounded.
  [Workers limits](https://developers.cloudflare.com/workers/platform/limits/#subrequests),
  [Durable Object allowances](https://developers.cloudflare.com/durable-objects/platform/pricing/).
- **GitHub:** Normally six metadata queries per invocation, or 24 per hour.
  Unauthenticated public access permits 60 per hour per IP; other usage and
  pagination may exceed that. Optionally use a fine-grained token for
  `ramiz4/riparim` only, exclusively **Actions: Read**; usually 5,000 requests
  per hour. The implemented maximum is 1,008 metadata requests per hour across
  four invocations. At the limits, the monitor remains in an error state.
  [GitHub API limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- **Resend Free:** 3,000 messages per month, 100 per day, shared with existing
  app/Auth emails. An unchanged outage of both jobs produces about two messages
  daily plus later recovery notices; frequent incident changes and tests increase
  this. Use the existing verified domain. A quota error blocks confirmed delivery
  and produces no success heartbeat. [Pricing](https://resend.com/pricing).
  API calls are spaced at least 600 ms apart; a shared team limit may still apply.
  [API limits](https://resend.com/docs/api-reference/usage-limits).
- **Healthchecks.io Hobbyist:** One of 20 free checks; 100 rolling log entries
  per check. 96 daily calls require no paid plan; the limited history covers
  approximately one day. Do not upgrade automatically if the check allowance
  is occupied. Configure and test email integration and bounded reminders.
  [Pricing and log retention](https://healthchecks.io/pricing/).

A separate Resend key must permit both sending and retrieving delivery status;
a `sending_access` key is insufficient. The required `full_access` grants broader
Resend access and belongs only in the private monitor runtime: the Node env file
or a Worker secret. The monitor needs no Supabase, D1, R2 or Git write access.
Store new keys and the secret heartbeat URL in the existing 1Password project
entry `mkp7xa42clfbreiv2q3b3nrq5y`; never give the monitor decryption keys.

## Operation, updates and alternative setup

### Cloudflare: active deployments and updates

`wrangler.backup-monitor.jsonc` is the authoritative production configuration
for the separate Worker. It contains `BACKUP_MONITOR_ENABLED=true`,
`BACKUP_MONITOR_PAUSED=false`, `BACKUP_MONITOR_SCHEDULE=*/15 * * * *` and exactly
one matching cron trigger. An ordinary deployment with this configuration
therefore preserves the authorized monitoring. Additional activation flags are
no longer needed. Website deployment uses a different configuration and does not
affect this Worker. The monitor still has no access to app D1/R2.

The configuration uses `compatibility_date=2026-05-22`, the latest date actually
supported locally by the locked Wrangler/workerd versions. A date or tool update
requires its own runtime and type checks. `npm run backups:worker:check` compares
the separately generated binding types, checks TypeScript and performs a local
Wrangler dry run. The regular suite uses this configuration's actual variables
and cron triggers in real workerd and requires a successful automatic check.
Mismatched schedules and explicitly paused runtimes still make no provider calls.

For later monitor updates:

1. Use only the exact source checkout of a fully published, verified GitHub main
   release; check tag and commit. The monitor is in the release source checkout,
   not in the website/Node app archive. Install locked tools and run
   `npm run backups:worker:check`.
2. Check the existing Worker, its SQLite namespace, active cron setting and main
   Healthchecks check. Healthchecks retains a 15-minute period, 15-minute grace
   and the confirmed operator email integration. An update needs no new Worker,
   namespace or check.
3. A deployment without new secrets preserves existing Worker secrets:

   ```sh
   node node_modules/wrangler/bin/wrangler.js deploy \
     --config wrangler.backup-monitor.jsonc
   ```

   If secrets are explicitly updated, provide only monitor values from 1Password
   in a private JSON file (`0600`) and additionally pass
   `--secrets-file /private/riparim-monitor-secrets.json`. Remove the file afterward.
   Never expose values as CLI arguments or in logs. The existing fine-grained
   GitHub token with `Actions: Read` is retained; GitHub rejected anonymous access
   during the live test.

4. After deployment, reread the three active variables, the sole
   `*/15 * * * *` trigger and unchanged SQLite namespace. Verify a protected
   `POST /run`, the next actual cron run and its Healthchecks heartbeat.
   A dry run alone confirms neither remote permissions nor delivery.
   The website and its bindings remain separate.

### Pause Cloudflare explicitly

Pausing is an explicit operational change: first pause the main Healthchecks
check, then set `BACKUP_MONITOR_ENABLED=false`, `BACKUP_MONITOR_PAUSED=true`,
an empty `BACKUP_MONITOR_SCHEDULE` and the cron list to `[]`. SQLite state is
preserved. The same change must be recorded in the authoritative repository
configuration through a reviewed PR and main release before further deployments;
otherwise the next active release would reenable monitoring. Later resumption
also requires an activation authorization and a resumed main Healthchecks check.

### Node

The Riparim operator is responsible. These steps are prepared and will be
performed only after a separate activation authorization:

1. Select an independent, continuously running host and the operator inbox;
   provide Node according to `package.json`. A sleeping laptop is unsuitable
   as a daily monitor. Check allowances and the email sender.
2. Deploy only the main commit belonging to a fully published, verified GitHub
   release, read-only under `/opt/riparim-monitor/current`. Check release tag and
   commit; install no feature branch or open PR. The monitor is included in this
   source checkout, not in the application archive. Updates also use a verified
   main release; private state remains outside the checkout.
3. Set up a Healthchecks.io Hobbyist check for **Riparim Backup Monitor** with a
   15-minute period and 15-minute grace. Verify its own email integration with
   the operator inbox, including missing-heartbeat alerts, recovery notices and
   bounded reminders. This second delivery path must work even when Resend API
   access is unavailable.
4. Create a dedicated unprivileged `riparim-backup-monitor` user. Copy the
   [env template](examples/backup-monitor.env.example) securely to
   `/etc/riparim-backup-monitor.env` (`root`, mode `0600`). Insert keys from
   1Password without exposing them in command arguments, shell history or logs.
   Initially retain `BACKUP_MONITOR_ENABLED=false` and
   `BACKUP_MONITOR_PAUSED=true`. Old Node configurations without a pause variable
   remain compatible.
5. Deploy the [service](examples/riparim-backup-monitor.service) and
   [timer](examples/riparim-backup-monitor.timer) after checking host paths;
   do not activate them initially. The state directory uses mode `0700`, the
   state file `0600`. It contains only technical status, time and delivery
   receipts and must not be shared with another monitor host.
6. Perform the harmless receipt acceptance test: connect `runBackupMonitor`
   to the real email adapter with synthetic main runs and artificial artifact
   metadata. For each job, check failure, a missing/disabled run, an invalid
   artifact, tolerated delay, bounded retries and a new successful subsequent
   backup. Do not alter real backup jobs or their archives. Check the delivery
   receipt **and** actual receipt of alert/recovery emails. The isolated fixtures
   in `tests/backup-monitor.test.mjs` demonstrate the contract; that test itself
   uses only simulated transport adapters.
7. Also simulate harmless invalid delivery credentials and an interrupted
   heartbeat. No healthy monitor status may result; the external missing-heartbeat
   email alert must arrive. Treat Healthchecks/GitHub/Resend unavailability as
   unknown state, not backup success. The external check and operator inbox also
   require recurring manual receipt checks; complete failure of all alert paths
   remains an explicitly documented operational limitation.
8. Only after documented acceptance, set `BACKUP_MONITOR_ENABLED=true` and
   `BACKUP_MONITOR_PAUSED=false` and activate the timer. It runs outside GitHub;
   a disabled backup schedule remains detectable. Check current status and the
   next timer invocation. Installation alone and the following default invocation
   activate nothing:

   ```sh
   npm run backups:monitor
   # {"status":"inactive"}
   ```

## Transfer state between Cloudflare and Node

`scripts/lib/backup-monitor-state.mjs` produces a shared JSON format with
`format`, `version`, `repository` and `state`, limited to 128 KiB. Unknown fields,
other repositories, incompatible versions, invalid or future timestamps are
rejected before any import. Incidents, generations, queue observations and the
pending message with payload, provider ID and retry key are preserved.
Credentials are not exported.

First pause the source monitor, wait for running checks and keep the target
disabled/paused too. Sender, recipient and Resend account must not change while
messages are pending. Both clocks must be correct. Existing target state is not
overwritten by default. `--replace` or `X-Monitor-Replace: true` is permitted only
after a private backup and deliberate comparison. Never enable both operating
modes simultaneously: that would not be failover and could send new incidents twice.

Node transfers must run as the same operating system user as the service so
that imported state remains readable to it. They need only the nonsecret pause
settings and state file path, not an env file containing provider credentials.
The commands use the existing exclusive lock file; files (`0600`) and the parent
directory (`0700`) remain private. First securely make a transfer file received
from Cloudflare accessible to this user. There are no provider/heartbeat calls:

```sh
sudo -u riparim-backup-monitor env \
  BACKUP_MONITOR_ENABLED=false BACKUP_MONITOR_PAUSED=true \
  BACKUP_MONITOR_STATE_PATH=/var/lib/riparim-backup-monitor/state.json \
  /usr/bin/node /opt/riparim-monitor/current/scripts/monitor-backups.mjs \
  export-state /var/lib/riparim-backup-monitor/transfer/state.json
sudo -u riparim-backup-monitor env \
  BACKUP_MONITOR_ENABLED=false BACKUP_MONITOR_PAUSED=true \
  BACKUP_MONITOR_STATE_PATH=/var/lib/riparim-backup-monitor/state.json \
  /usr/bin/node /opt/riparim-monitor/current/scripts/monitor-backups.mjs \
  import-state /var/lib/riparim-backup-monitor/transfer/state.json
# Only after backing up existing target state: --replace
```

Cloudflare offers `GET /state` and `PUT /state` on the reported Worker URL.
Both require `Authorization: Bearer …` with the private transfer token and the
same paused state. Active requests are rejected with 409. The token belongs in
a private Curl configuration file (`0600`), not in command arguments or the URL.
Example with nonsecret `MONITOR_URL`:

```sh
umask 077
curl --fail --config /private/monitor-transfer.curl \
  "$MONITOR_URL/state" --output /private/monitor-state.json
curl --fail --config /private/monitor-transfer.curl \
  --request PUT --data-binary @/private/monitor-state.json \
  "$MONITOR_URL/state"
```

If target state already exists, add the nonsecret `X-Monitor-Replace: true` header
only after backing it up. Export responses use `Cache-Control: no-store`.
After import, first check target state and pending delivery receipts, then enable
only the target. The source remains paused. Use the same steps for the return
path. Decryption or reverse transfer of Supabase/D1/R2 data is not part of this switch.

## Resolve errors and resume safely

On a backup alert, first check the linked run and its artifact, resolve the cause
and rerun the affected main workflow. The other backup does not replace it.
A backup restore remains a separate authorization under the
[Auth backup guide](auth-backups.md) or [platform backup guide](platform-backups.md).

On a monitor alert, privately check service state, host, clock, allowances,
network, state permissions and delivery receipts. Provider error messages are
not logged publicly. Do not "repair" persistent pending messages by deleting all
state: that loses incidents and deduplication. The delivery payload and idempotency
key are saved atomically with `fsync` before sending. Do not change sender,
recipient or provider account while sends are pending; first unambiguously
reconcile their delivery. Resend retains keys for 24 hours; unconfirmed sends
are retried automatically for at most 23 hours with the same bytes. Afterward,
privately reconcile the provider receipt and correct only the individual pending
entry once its outcome is unambiguous. No automatic resend after expiry.
[Idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

The lock file prevents concurrent invocations. It deliberately remains after
abrupt process termination. First stop the timer, reliably rule out any running
monitor process, then remove only its orphaned `state.json.lock`. Preserve private
state. On rollback, stop the timer and compare the state version with the earlier
verified main release; unknown versions remain errors. Without timer/heartbeat,
monitoring is explicitly disabled and provides no protection.

The regular test suite runs the offline regressions:

```sh
node tests/backup-monitor.test.mjs
node tests/backup-monitor-portable.test.mjs
node tests/backup-monitor-worker.test.mjs
npm run backups:worker:check
npm test
```

They verify requirements with synthetic data and simulated GitHub, Resend and
heartbeat responses, including delivery errors and interrupted delivery states.
They claim no actual inbox receipt.
