# Backup monitoring

The dedicated `riparim-backup-monitor` Worker checks both backup workflows every
15 minutes. Checked-in configuration enables it; the October 13, 2026 acceptance
verified cron, alert/recovery inbox receipt and missing-heartbeat alerts.
Check live state before operating. Node is a prepared, disabled alternative.

## Health and alerts

A healthy backup needs a completed successful `main` run and the nonempty,
unexpired artifact of its current attempt: `supabase-auth-<run_id>-<attempt>`
or `platform-<run_id>-<attempt>`. The monitor reads metadata, never archives or keys.

| Condition                                                 | Alert threshold                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Failed/cancelled/skipped/disabled job or invalid artifact | Next check                                                         |
| No verified backup                                        | Immediately; or 36 hours after the last valid completion           |
| Running job                                               | 30 minutes                                                         |
| Queued attempt                                            | Two hours; ambiguous timestamp uses persisted first observation    |
| Unchanged incident                                        | At most one reminder/job/24 hours; new valid backup sends recovery |

`monitorHealthy` means checking, state and required delivery work; `backupsHealthy`
is separate. A reported backup failure may accompany a healthy monitor.
API/quota/state/unknown-delivery errors produce no success heartbeat.
Healthchecks.io detects missing monitor runs independently of GitHub.
Alert mail contains technical status/time and fixed GitHub links only.

## Update Cloudflare

[wrangler.backup-monitor.jsonc](../../wrangler.backup-monitor.jsonc) is authoritative:
`ENABLED=true`, `PAUSED=false`, `SCHEDULE=*/15 * * * *` with the full
`BACKUP_MONITOR_` prefix and one matching cron. Its SQLite Durable Object stores
state; website deployment changes neither monitor config nor app bindings here.

1. Use the source checkout of a fully published verified main release.
   The monitor is not in the website/Node app archive. Install locked tools and run
   `npm run backups:worker:check`.
2. Check the existing Worker/namespace and Healthchecks period/grace (15 minutes
   each), operator inbox and allowances. Preserve the existing resources.
3. Deploy the release's monitor configuration; omission preserves Worker secrets.
4. Reread active variables/cron/namespace. Verify protected `POST /run`, next
   actual cron and heartbeat; a dry run does not prove live delivery or permissions.

```sh
node node_modules/wrangler/bin/wrangler.js deploy \
  --config wrangler.backup-monitor.jsonc
```

If updating secrets, use a private `0600` JSON file with `--secrets-file`, then remove
it. The monitor needs its own Resend key permitting send **and receipt retrieval**,
heartbeat URL, sender/recipient, transfer token and preferably GitHub **Actions: Read**
for this repository only. Keep them in the project vault/runtime, never argv/logs.
It needs no Supabase/D1/R2/Git-write access or backup decryption keys.

## Pause, alternatives and state transfer

To pause, first pause Healthchecks, then explicitly set `ENABLED=false`,
`PAUSED=true`, empty `SCHEDULE` and `crons: []`. Preserve state and record the change
through a reviewed PR/main release; otherwise another active release reenables it.
Resumption needs authorization and a resumed Healthchecks check.

Node requires an independent always-on host and a dedicated user; a sleeping
laptop is unsuitable. Deploy verified release source at `/opt/riparim-monitor/current`.
Use the [env](../examples/backup-monitor.env.example),
[service](../examples/riparim-backup-monitor.service) and
[timer](../examples/riparim-backup-monitor.timer) templates with private env/state
(`0600`, parent `0700`). Keep both enable/pause defaults until synthetic live alert,
recovery, failed-delivery and missing-heartbeat inbox acceptance; then activate only
with operator authorization. `npm run backups:monitor` is inactive by default.

Transfer state with both variants paused and no checks running. Preserve pending
payloads, retry keys and provider receipts; sender/recipient/provider account stay
unchanged. Never enable both modes. Back up and compare target state before `--replace`.
Run Node transfer as the service user, with the same state path and nonsecret pause
settings; no provider credentials are needed:

```sh
BACKUP_MONITOR_ENABLED=false BACKUP_MONITOR_PAUSED=true \
BACKUP_MONITOR_STATE_PATH=/private/state.json \
node scripts/monitor-backups.mjs export-state /private/transfer.json
BACKUP_MONITOR_ENABLED=false BACKUP_MONITOR_PAUSED=true \
BACKUP_MONITOR_STATE_PATH=/private/state.json \
node scripts/monitor-backups.mjs import-state /private/transfer.json
```

Cloudflare uses protected `GET /state` and `PUT /state`; paused requests only.
Put the bearer token in private curl config, not URL/argv. Existing target replacement
also needs deliberate `X-Monitor-Replace: true`. Unknown versions/repositories,
invalid/future timestamps and state over 128 KiB fail before import.

## Resolve an alert

Check the linked job/artifact and rerun the affected main workflow after repair.
[Backup restore](backups.md) remains a separate operation.
For monitor errors, inspect clock, private state/lock, access, quotas and receipts.
Keep pending state: Resend retries use identical bytes/key for at most 23 hours;
after expiry or unknown acceptance, reconcile privately before any individual repair.
Remove only an orphaned lock after stopping the timer and ruling out all processes.

Cloudflare bounds external checks to four minutes and 45 provider calls plus a
failure report. Reached limits remain errors. Existing Free allowances are shared;
check actual usage and never enable paid overages automatically. Test actual inbox
receipt periodically; all alert channels may fail together.
Offline checks: `tests/backup-monitor*.test.mjs` and `npm run backups:worker:check`.
