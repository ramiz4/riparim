const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export const MONITOR_REPOSITORY = 'ramiz4/riparim';
const repository = MONITOR_REPOSITORY;
const workflows = [
  {file: 'auth-backup.yml', name: 'Supabase Auth Backup', prefix: 'supabase-auth'},
  {file: 'platform-backup.yml', name: 'Platform Backup', prefix: 'platform'},
];
const hour = 60 * 60 * 1000;
const runStatuses = new Set(['completed', 'in_progress', 'queued', 'requested', 'waiting', 'pending']);
const queueStatuses = new Set(['queued', 'requested', 'waiting', 'pending']);
const conclusions = new Set(['success', 'failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required', 'stale', 'startup_failure']);
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('Invalid timestamp.');
  if (new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19)) throw Error('Invalid calendar date.');
  return Date.parse(value);
}
function validateRun(run, now) {
  if (!Number.isSafeInteger(run.id) || run.id < 1 || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 ||
    typeof run.head_branch !== 'string' || !runStatuses.has(run.status) || (run.conclusion !== null && !conclusions.has(run.conclusion))) throw Error('Invalid run metadata.');
  const created = timestamp(run.created_at), updated = timestamp(run.updated_at);
  const started = run.run_started_at == null ? null : timestamp(run.run_started_at);
  if (created > updated || updated > now || started !== null && (started < created || started > updated) ||
    (run.status === 'completed' || run.status === 'in_progress') && started === null) throw Error('Invalid run chronology.');
}

/** @param {{fetch?: typeof globalThis.fetch, token?: string, now?: number}} [options] */
export function createGitHubReader({fetch = globalThis.fetch, token, now} = {}) {
  const base = `https://api.github.com/repos/${repository}/actions`;
  const headers = {Accept: 'application/vnd.github+json', 'User-Agent': 'Riparim-Backup-Monitor', 'X-GitHub-Api-Version': '2026-03-10',
    ...(token ? {Authorization: `Bearer ${token}`} : {})};
  async function request(path, allowMissing = false) {
    const response = await fetch(base + path, {headers, signal: AbortSignal.timeout(10000), redirect: 'manual'});
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw Error('GitHub metadata request failed.');
    return response.json();
  }
  async function list(path, field) {
    const items = [];
    for (let page = 1; page <= 5; page++) {
      const value = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      if (!Number.isSafeInteger(value.total_count) || value.total_count < 0 || !Array.isArray(value[field]) || value[field].length > 100) throw Error('Invalid GitHub list.');
      items.push(...value[field]);
      if (items.length >= value.total_count) return items;
      if (!value[field].length) throw Error('Incomplete GitHub list.');
    }
    throw Error('GitHub metadata exceeds the bounded history.');
  }
  return async workflow => {
    const metadata = await request(`/workflows/${workflow.file}`, true);
    if (!metadata) return {state: 'missing', runs: []};
    if (!['active', 'deleted', 'disabled_manually', 'disabled_inactivity', 'disabled_fork'].includes(metadata.state)) throw Error('Invalid workflow metadata.');
    // GitHub permits retries of runs created up to 30 days ago; include the 36h backup grace too.
    const since = encodeURIComponent(`>=${new Date((now ?? Date.now()) - 32 * 24 * hour).toISOString()}`);
    const runs = await list(`/workflows/${workflow.file}/runs?branch=main&exclude_pull_requests=true&created=${since}`, 'workflow_runs');
    const observedAt = now ?? Date.now();
    for (const run of runs) {validateRun(run, observedAt); run.artifacts = [];}
    if (new Set(runs.map(run => run.id)).size !== runs.length) throw Error('Duplicate workflow history.');
    runs.sort((a, b) => timestamp(b.updated_at) - timestamp(a.updated_at));
    let inspected = 0, queueAttempts = 0;
    for (const run of runs) {
      if (run.head_branch === 'main' && queueStatuses.has(run.status) && run.run_attempt > 1) {
        run.queue_started_at = null;
        if (queueAttempts < 20) {
          queueAttempts++;
          const attempt = await request(`/runs/${run.id}/attempts/${run.run_attempt}`, true);
          if (attempt) {
            if (attempt.id !== run.id || attempt.run_attempt !== run.run_attempt) throw Error('Invalid queue attempt.');
            if (attempt.created_at != null) {
              const created = timestamp(attempt.created_at);
              if (created < timestamp(run.created_at) || created > (now ?? Date.now())) throw Error('Invalid queue attempt chronology.');
              // Attempt-specific creation is distinct from the parent run's original creation.
              if (created > timestamp(run.created_at)) run.queue_started_at = attempt.created_at;
            }
          }
        }
      }
      if (run.head_branch === 'main' && run.status === 'completed' && run.conclusion === 'success') {
        if (++inspected > 20) throw Error('Too many unverifiable backup attempts.');
        run.artifacts = await list(`/runs/${run.id}/artifacts`, 'artifacts');
        if (validBackup(workflow, run, observedAt)) break;
      }
    }
    return {state: metadata.state, runs};
  };
}

function validBackup(workflow, run, now) {
  return run.status === 'completed' && run.conclusion === 'success' &&
    run.artifacts.some(artifact => {
      if (artifact.name !== `${workflow.prefix}-${run.id}-${run.run_attempt}`) return false;
      if (typeof artifact.expired !== 'boolean' || !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes < 0) throw Error('Invalid artifact metadata.');
      const created = timestamp(artifact.created_at), expires = timestamp(artifact.expires_at);
      return artifact.expired === false && artifact.size_in_bytes > 0 && expires > now && expires > created &&
        created <= timestamp(run.updated_at) && created >= timestamp(run.run_started_at);
    });
}

function evaluate(workflow, snapshot, now, job) {
  const runs = snapshot.runs.filter(run => run.head_branch === 'main').sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const retryQueues = runs.filter(run => run.run_attempt > 1 && queueStatuses.has(run.status));
  const queuedKeys = new Set(retryQueues.map(run => `${run.id}-${run.run_attempt}`));
  if (queuedKeys.size > 500) throw Error('Too many queue observations.');
  for (const key of Object.keys(job.queueStartedAt)) if (!queuedKeys.has(key)) delete job.queueStartedAt[key];
  for (const run of retryQueues) {
    const key = `${run.id}-${run.run_attempt}`, started = run.queue_started_at ? timestamp(run.queue_started_at) : now;
    if (started > now) throw Error('Future queue observation.');
    // Keep the earliest trusted time, so metadata churn or a restart cannot renew grace.
    job.queueStartedAt[key] = Math.min(job.queueStartedAt[key] ?? now, started);
  }
  const successful = runs.find(run => validBackup(workflow, run, now));
  let linkedRun = runs[0];
  let status = 'healthy';
  if (!successful || now - Date.parse(successful.updated_at) >= 36 * hour) status = 'missing';
  // Inspect everything after the verified backup: a queued retry must not hide a failure.
  for (const run of runs) {
    if (run === successful) break;
    if (run.status === 'completed') {
      status = run.conclusion === 'success' ? 'invalid_artifact' : run.conclusion ?? 'incomplete';
      linkedRun = run;
      break;
    }
    const started = run.status === 'in_progress' ? timestamp(run.run_started_at) :
      run.run_attempt === 1 ? timestamp(run.created_at) : job.queueStartedAt[`${run.id}-${run.run_attempt}`];
    if (now - started >= (run.status === 'in_progress' ? hour / 2 : 2 * hour)) {
      status = 'stuck';
      linkedRun = run;
      break;
    }
  }
  if (snapshot.state !== 'active') {status = snapshot.state === 'missing' ? 'missing' : 'disabled'; linkedRun = null;}
  return {job: workflow.name, status, lastSuccessAt: successful ? new Date(successful.updated_at).toISOString() : null,
    url: linkedRun ? `https://github.com/${repository}/actions/runs/${linkedRun.id}` : `https://github.com/${repository}/actions/workflows/${workflow.file}`};
}

const statusLabels = {healthy: 'Gesund', failure: 'Sicherung fehlgeschlagen', cancelled: 'Sicherung abgebrochen',
  timed_out: 'Sicherung abgelaufen', skipped: 'Sicherung übersprungen', neutral: 'Sicherung ohne Erfolg',
  action_required: 'Sicherung benötigt Eingriff', stale: 'Sicherung veraltet', startup_failure: 'Sicherung nicht gestartet',
  incomplete: 'Sicherung nicht abgeschlossen', invalid_artifact: 'Gültiges Backup-Artefakt fehlt', missing: 'Sicherung fehlt',
  disabled: 'Workflow deaktiviert', stuck: 'Sicherung hängt', monitor_error: 'Prüfung fehlgeschlagen',
  awaiting_backup: 'Neue Sicherung ausstehend', recovered: 'Entwarnung: Sicherung erfolgreich'};
/** @param {{apiKey?: string, from?: string, to?: string, fetch?: typeof globalThis.fetch, wait?: (milliseconds: number) => Promise<unknown>}} [options] */
export function createResendNotifier({apiKey, from, to, fetch = globalThis.fetch, wait = delay} = {}) {
  if (!apiKey || /[\r\n]/.test(apiKey) || typeof from !== 'string' || !/^[^\r\n]+@[^\r\n]+$/.test(from) ||
    typeof to !== 'string' || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) throw Error('Invalid email configuration.');
  const headers = {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'};
  let lastRequest = 0;
  async function request(path, options = {}) {
    await wait(Math.max(0, 600 - (Date.now() - lastRequest)));
    lastRequest = Date.now();
    const response = await fetch(`https://api.resend.com${path}`, {...options, headers: {...headers, ...options.headers},
      redirect: 'manual', signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('Email provider request failed.');
    return response.json();
  }
  return {
    async send(message, key) {
      if (!Object.hasOwn(statusLabels, message.status)) throw Error('Invalid notification status.');
      const text = `Job: ${message.job}\nStatus: ${statusLabels[message.status]}\nLetzte erfolgreiche Sicherung: ${message.lastSuccessAt ?? 'keine verifiziert'}\nLink: ${message.url}`;
      const value = await request('/emails', {method: 'POST', headers: {'Idempotency-Key': key},
        body: JSON.stringify({from, to: [to], subject: `${message.job}: ${statusLabels[message.status]}`, text})});
      if (typeof value.id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.id)) throw Error('Invalid email receipt.');
      return value.id;
    },
    async delivery(id) {
      const value = await request(`/emails/${encodeURIComponent(id)}`);
      return ['delivered', 'opened', 'clicked'].includes(value.last_event) ? 'delivered' : 'unknown';
    },
  };
}

export function validateMonitorState(state, now) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const date = value => value === null || timestamp(value) <= now;
  const time = value => Number.isSafeInteger(value) && value >= 0 && value <= now;
  if (!object(state) || state.version !== 1 || !object(state.jobs)) throw Error('Invalid monitor state.');
  for (const [file, job] of Object.entries(state.jobs)) {
    const workflow = workflows.find(workflow => workflow.file === file);
    if (!workflow || !object(job) || !date(job.lastSuccessAt) || !Number.isSafeInteger(job.generation) || job.generation < 0) throw Error('Invalid job state.');
    if (job.queueStartedAt !== undefined && (!object(job.queueStartedAt) || Object.keys(job.queueStartedAt).length > 500 ||
      Object.entries(job.queueStartedAt).some(([key, started]) => !/^[1-9]\d*-[1-9]\d*$/.test(key) || !time(started)))) throw Error('Invalid queue observations.');
    if (job.incident !== null && (!object(job.incident) || !time(job.incident.openedAt) || !date(job.incident.backupAt) ||
      !date(job.incident.recoveredAt) || !Number.isSafeInteger(job.incident.generation) || job.incident.generation < 1 || job.incident.generation !== job.generation ||
      !Object.hasOwn(statusLabels, job.incident.kind) || !(job.incident.lastNotificationAt === null || time(job.incident.lastNotificationAt)))) throw Error('Invalid incident state.');
    if (job.pending !== null) {
      const pending = job.pending, message = pending?.message;
      const key = typeof pending?.key === 'string' ? new RegExp(`^${file.replaceAll('.', '\\.')}-([0-9]+)-([0-9]+)-([0-9]+|recovered)$`).exec(pending.key) : null;
      if (!job.incident || !object(pending) || !time(pending.createdAt) || !Number.isSafeInteger(pending.generation) || pending.generation < 1 || pending.generation > job.generation || typeof pending.key !== 'string' ||
        !key || !time(Number(key[1])) || Number(key[1]) > pending.createdAt || Number(key[2]) !== pending.generation ||
        (message?.status === 'recovered' ? key[3] !== 'recovered' : key[3] === 'recovered' || Number(key[3]) !== Math.floor((pending.createdAt - Number(key[1])) / (24 * hour))) ||
        (pending.generation === job.generation && Number(key[1]) !== job.incident.openedAt) ||
        !(pending.id === null || typeof pending.id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(pending.id)) ||
        !object(message) || message.job !== workflow.name || !Object.hasOwn(statusLabels, message.status) || !date(message.lastSuccessAt) ||
        !(message.url === `https://github.com/${repository}/actions/workflows/${file}` ||
          typeof message.url === 'string' && /^https:\/\/github\.com\/ramiz4\/riparim\/actions\/runs\/\d+$/.test(message.url))) throw Error('Invalid pending notification.');
    }
  }
}

export async function runBackupMonitor({now: requestedAt, readWorkflow, store, notifier, heartbeat}) {
  let now = requestedAt ?? Date.now();
  const jobs = [];
  let monitorHealthy = true;
  try {
    const state = await store.load() ?? {version: 1, jobs: {}};
    validateMonitorState(state, now);
    for (const workflow of workflows) {
      const job = state.jobs[workflow.file] ??= {lastSuccessAt: null, generation: 0, incident: null, pending: null};
      job.queueStartedAt ??= {};
      let result;
      try {
        const snapshot = await readWorkflow(workflow);
        now = requestedAt ?? Date.now();
        result = evaluate(workflow, snapshot, now, job);
      } catch {
        now = requestedAt ?? Date.now();
        monitorHealthy = false;
        result = {job: workflow.name, status: 'monitor_error', lastSuccessAt: null,
          url: `https://github.com/${repository}/actions/workflows/${workflow.file}`};
      }
      const verifiedBackupAt = result.lastSuccessAt;
      if (verifiedBackupAt && (!job.lastSuccessAt || timestamp(verifiedBackupAt) > timestamp(job.lastSuccessAt))) job.lastSuccessAt = verifiedBackupAt;
      result.lastSuccessAt = job.lastSuccessAt;
      jobs.push(result);
      const hasNewBackup = verifiedBackupAt && (!job.incident?.backupAt || timestamp(verifiedBackupAt) > timestamp(job.incident.backupAt));
      // Observations are independent of the immutable notification being retried.
      if (result.status !== 'healthy') {
        if (!job.incident || job.incident.recoveredAt || hasNewBackup || job.incident.kind === 'monitor_error' && result.status !== 'monitor_error') {
          job.incident = {generation: ++job.generation, openedAt: now, backupAt: result.lastSuccessAt,
            kind: result.status, recoveredAt: null, lastNotificationAt: null};
        }
      } else if (job.incident && (hasNewBackup || job.incident.kind === 'monitor_error')) {
        job.incident.recoveredAt = verifiedBackupAt;
      }
      await store.save(state);
      async function flushPending() {
        if (!job.pending) return;
        try {
          if (!job.pending.id) {
            // Resend retains keys for 24h. An ambiguous older send needs operator reconciliation.
            if (now - job.pending.createdAt >= 23 * hour) throw Error('Uncertain notification expired.');
            job.pending.id = await notifier.send(job.pending.message, job.pending.key);
            await store.save(state);
          }
          if (await notifier.delivery(job.pending.id) === 'delivered') {
            // A delayed receipt can only update the incident that created it.
            if (job.incident?.generation === job.pending.generation) {
              if (job.pending.message.status === 'recovered') job.incident = null;
              else job.incident.lastNotificationAt = job.pending.createdAt;
            }
            job.pending = null;
          } else monitorHealthy = false;
        } catch {
          monitorHealthy = false;
        }
      }
      await flushPending();
      if (result.status === 'healthy' && job.incident && !job.incident.recoveredAt) result.status = 'awaiting_backup';
      if (!job.pending && job.incident) {
        let message;
        if (job.incident.recoveredAt) message = {...result, status: 'recovered'};
        else if (job.incident.lastNotificationAt === null || now - job.incident.lastNotificationAt >= 24 * hour) message = {...result};
        if (message) {
          const key = `${workflow.file}-${job.incident.openedAt}-${job.incident.generation}-${message.status === 'recovered' ? 'recovered' : Math.floor((now - job.incident.openedAt) / (24 * hour))}`;
          job.pending = {key, message, generation: job.incident.generation, createdAt: now, id: null};
          // Store the exact retry payload before the provider can accept the email.
          await store.save(state);
          await flushPending();
        }
      }
      await store.save(state);
    }
  } catch {
    monitorHealthy = false;
  }
  try {await heartbeat(monitorHealthy);} catch {monitorHealthy = false;}
  return {monitorHealthy, backupsHealthy: monitorHealthy && jobs.length === workflows.length && jobs.every(job => job.status === 'healthy'), jobs};
}

export function createHeartbeat({url, fetch = globalThis.fetch}) {
  if (!/^https:\/\/hc-ping\.com\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(url)) throw Error('Invalid watchdog URL.');
  return async healthy => {
    const response = await fetch(url + (healthy ? '' : '/fail'), {method: 'POST', body: '', redirect: 'manual', signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('Watchdog request failed.');
  };
}
