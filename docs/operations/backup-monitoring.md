# Backup monitoring

The dedicated `riparim-backup-monitor` Worker checks both [backup workflows](backups.md)
every 15 minutes. Checked-in configuration enables it; verify live state before operating.
Healthchecks.io independently detects missing monitor runs. Node is a disabled alternative.

## Understand an alert

A valid backup is a successful completed `main` run with its current attempt's nonempty,
unexpired artifact. The monitor reads metadata only, never archives or decryption keys.

| Condition                                                 | Alert threshold                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| Failed/cancelled/skipped/disabled job or invalid artifact | Next check                                                           |
| No valid backup                                           | Immediately, or 36 hours after last valid completion                 |
| Running job                                               | 30 minutes                                                           |
| Queued attempt                                            | Two hours                                                            |
| Unchanged incident                                        | At most one reminder/job/24 hours; a new valid backup sends recovery |

Backup failure and monitor failure are separate. API/quota/state/uncertain-delivery errors
produce no success heartbeat. Alert mail contains technical status/times and fixed links.

## Update the Worker

1. Use source from a fully published [verified main release](releases.md); the monitor
   is outside website/Node app archives. Install locked tools and run
   `npm run backups:worker:check`.
2. Verify existing Worker/namespace, operator inbox, allowances and Healthchecks period/
   grace (15 minutes each). Preserve existing resources.
3. Deploy its [configuration](../../wrangler.backup-monitor.jsonc): `BACKUP_MONITOR_ENABLED=true`,
   `BACKUP_MONITOR_PAUSED=false`, `BACKUP_MONITOR_SCHEDULE=*/15 * * * *` and matching cron.

   ```sh
   node node_modules/wrangler/bin/wrangler.js deploy --config wrangler.backup-monitor.jsonc
   ```

4. Reread active variables/cron/namespace. Verify protected `POST /run`, actual next cron,
   heartbeat and inbox receipt; dry runs do not prove live permissions/delivery.

Use a private `0600` JSON `--secrets-file` and remove it afterward; omission preserves
Worker secrets. Required secrets are its own Resend key with send **and receipt retrieval**,
heartbeat URL, sender/recipient, transfer token and preferably repository-only GitHub
**Actions: Read**. No Supabase/D1/R2/Git-write access or backup key is needed.
Keep secrets in protected vault/runtime, never argv/logs. Website deploys do not update it.

## Pause or change runtime

Pause Healthchecks first, then set `ENABLED=false`, `PAUSED=true`, empty `SCHEDULE`
(all with `BACKUP_MONITOR_` prefix) and `crons: []`. Preserve state and record this through
reviewed PR/main release so a later release cannot silently reenable it. Resumption needs
authorization and a resumed Healthchecks check.

Node needs an always-on host/dedicated user, not a sleeping laptop. Use verified source
at `/opt/riparim-monitor/current` with the [env](../examples/backup-monitor.env.example),
[service](../examples/riparim-backup-monitor.service) and
[timer](../examples/riparim-backup-monitor.timer). Keep env/state `0600`, parent `0700`.
Keep disabled/paused defaults until live alert/recovery, failed-delivery and missing-
heartbeat acceptance; activate only with authorization. Never enable both runtimes.

Transfer state only with both paused and no checks running. Preserve pending payloads,
retry keys and receipts, with unchanged sender/recipient/provider. Back up and compare
existing target state before deliberate replacement. As the Node service user:

```sh
BACKUP_MONITOR_ENABLED=false BACKUP_MONITOR_PAUSED=true \
BACKUP_MONITOR_STATE_PATH=/private/state.json \
node scripts/monitor-backups.mjs export-state /private/transfer.json
BACKUP_MONITOR_ENABLED=false BACKUP_MONITOR_PAUSED=true \
BACKUP_MONITOR_STATE_PATH=/private/state.json \
node scripts/monitor-backups.mjs import-state /private/transfer.json
```

Worker uses protected `GET /state` / `PUT /state` while paused; use private curl config
for the bearer token. Existing-target replacement also requires `X-Monitor-Replace: true`.

## Resolve failures

Repair/rerun the linked main backup job; [restore](backups.md) is separate. For monitor
errors check clock, state/lock, access, quotas and receipts. Keep pending state: Resend
retry must preserve bytes/key for at most 23 hours. After expiry/unknown acceptance,
reconcile privately before individual repair. Remove only orphaned locks with timer
stopped and all processes ruled out. Resource limits remain errors; never enable paid
overages automatically. Check actual inbox receipt periodically; all channels may fail.
