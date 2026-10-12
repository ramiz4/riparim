import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFileStore, createHeartbeat, createGitHubReader, createResendNotifier, runBackupMonitor, runMonitorCli} from '../scripts/monitor-backups.mjs';

const now = Date.parse('2026-10-12T12:00:00Z');
const workflows = ['auth-backup.yml', 'platform-backup.yml'];
const names = ['Supabase Auth Backup', 'Platform Backup'];
function success(index, overrides = {}) {
  const id = 100 + index;
  return {id, run_attempt: 1, head_branch: 'main', status: 'completed', conclusion: 'success',
    created_at: '2026-10-12T10:55:00Z', run_started_at: '2026-10-12T10:56:00Z', updated_at: '2026-10-12T11:00:00Z',
    artifacts: [{name: `${index ? 'platform' : 'supabase-auth'}-${id}-1`, expired: false, size_in_bytes: 100,
      created_at: '2026-10-12T10:59:00Z', expires_at: '2026-10-26T10:59:00Z'}], ...overrides};
}
function fixture(snapshots = workflows.map((_, i) => ({state: 'active', runs: [success(i)]}))) {
  let state;
  const sent = [], pings = [];
  const options = {now, readWorkflow: async workflow => snapshots[workflows.indexOf(workflow.file)],
    store: {load: async () => structuredClone(state), save: async value => {state = structuredClone(value);}},
    notifier: {send: async (message, key) => {sent.push({message, key}); return `mail-${sent.length}`;}, delivery: async () => 'delivered'},
    heartbeat: async ok => {pings.push(ok);}};
  return {options, sent, pings, state: () => state};
}

for (const index of [0, 1]) {
  const snapshots = workflows.map((_, i) => ({state: 'active', runs: [success(i)]}));
  snapshots[index].runs.unshift(success(index, {id: 200 + index, conclusion: 'failure',
    created_at: '2026-10-12T11:55:00Z', updated_at: '2026-10-12T11:59:00Z', artifacts: []}));
  const test = fixture(snapshots);
  const result = await runBackupMonitor(test.options);
  assert.equal(test.sent.length, 1, `a failure of ${names[index]} sends its own alert`);
  assert.deepEqual(test.sent[0].message, {job: names[index], status: 'failure', lastSuccessAt: '2026-10-12T11:00:00.000Z',
    url: `https://github.com/ramiz4/riparim/actions/runs/${200 + index}`});
  assert.equal(result.jobs[index].status, 'failure');
  assert.equal(result.jobs[1 - index].status, 'healthy');
  assert.equal(result.monitorHealthy, true, 'a successfully reported backup incident does not mean the monitor failed');
}

for (const invalid of [[], [{...success(0).artifacts[0], expired: true}],
  [{...success(0).artifacts[0], expires_at: '2026-10-12T12:00:00Z'}],
  [{...success(0).artifacts[0], name: 'supabase-auth-100-2'}],
  [{...success(0).artifacts[0], size_in_bytes: 0}]]) {
  const test = fixture([{state: 'active', runs: [success(0, {artifacts: invalid})]}, {state: 'active', runs: [success(1)]}]);
  const result = await runBackupMonitor(test.options);
  assert.equal(result.jobs[0].status, 'invalid_artifact', 'success without a valid current-attempt archive is not healthy');
  assert.equal(test.sent[0].message.lastSuccessAt, null);
}
{
  const test = fixture([{state: 'active', runs: [success(0, {head_branch: 'feature'})]}, {state: 'active', runs: [success(1)]}]);
  const result = await runBackupMonitor(test.options);
  assert.equal(result.jobs[0].status, 'missing', 'a feature-branch backup cannot hide a missing main backup');
}
for (const index of [0, 1]) {
  const snapshots = workflows.map((_, i) => ({state: 'active', runs: [success(i)]}));
  snapshots[index].state = 'disabled_inactivity';
  const test = fixture(snapshots);
  assert.equal((await runBackupMonitor(test.options)).jobs[index].status, 'disabled');
  assert.equal(test.sent[0].message.job, names[index]);
}
for (const [at, expected] of [['2026-10-11T00:01:00Z', 'healthy'], ['2026-10-11T00:00:00Z', 'missing']]) {
  const run = success(0, {created_at: at, run_started_at: at, updated_at: at,
    artifacts: [{...success(0).artifacts[0], created_at: at}]});
  const test = fixture([{state: 'active', runs: [run]}, {state: 'active', runs: [success(1)]}]);
  assert.equal((await runBackupMonitor(test.options)).jobs[0].status, expected, '36-hour threshold is measured from verified completion');
}
for (const [status, start, expected] of [
  ['in_progress', '2026-10-12T11:31:00Z', 'healthy'], ['in_progress', '2026-10-12T11:30:00Z', 'stuck'],
  ['queued', '2026-10-12T10:01:00Z', 'healthy'], ['queued', '2026-10-12T10:00:00Z', 'stuck'],
  ['waiting', '2026-10-12T10:00:00Z', 'stuck'],
]) {
  const run = success(0, {id: 200, status, conclusion: null, created_at: start, run_started_at: start,
    updated_at: '2026-10-12T11:59:00Z', artifacts: []});
  const test = fixture([{state: 'active', runs: [run, success(0)]}, {state: 'active', runs: [success(1)]}]);
  assert.equal((await runBackupMonitor(test.options)).jobs[0].status, expected);
}
for (const conclusion of ['cancelled', 'timed_out', 'skipped', 'neutral', null]) {
  const test = fixture([{state: 'active', runs: [success(0, {conclusion})]}, {state: 'active', runs: [success(1)]}]);
  assert.notEqual((await runBackupMonitor(test.options)).jobs[0].status, 'healthy');
}
{
  const snapshots = [{state: 'active', runs: [success(0, {id: 200, conclusion: 'failure', updated_at: '2026-10-12T11:59:00Z'}), success(0)]},
    {state: 'active', runs: [success(1)]}];
  const test = fixture(snapshots);
  await runBackupMonitor(test.options);
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  assert.equal(test.sent.length, 1, 'repeated checks do not repeat the alert');
  await runBackupMonitor({...test.options, now: now + 24 * 60 * 60 * 1000});
  assert.equal(test.sent.filter(item => item.message.job === names[0]).length, 2, 'persistent incidents remind at most daily');
  const recoveryAt = '2026-10-13T13:00:00Z';
  snapshots[0].runs = [success(0, {id: 300, created_at: recoveryAt, run_started_at: recoveryAt, updated_at: recoveryAt,
    artifacts: [{...success(0).artifacts[0], name: 'supabase-auth-300-1', created_at: recoveryAt}]})];
  await runBackupMonitor({...test.options, now: Date.parse(recoveryAt)});
  assert.equal(test.sent.at(-1).message.status, 'recovered');
  assert.equal(test.state().jobs['auth-backup.yml'].incident, null);
  const count = test.sent.length;
  await runBackupMonitor({...test.options, now: Date.parse(recoveryAt) + 15 * 60 * 1000});
  assert.equal(test.sent.length, count, 'the recovery is delivered once');
}
{
  const test = fixture();
  const read = test.options.readWorkflow;
  test.options.readWorkflow = async workflow => {if (workflow.file === workflows[0]) throw Error('private-token-and-account'); return read(workflow);};
  const result = await runBackupMonitor(test.options);
  assert.equal(result.monitorHealthy, false, 'API failures are inconclusive and fail the watchdog');
  assert.equal(result.jobs[0].status, 'monitor_error');
  assert.equal(result.jobs[1].status, 'healthy', 'the other workflow is still checked');
  assert.equal(test.pings.at(-1), false);
  assert(!JSON.stringify({result, state: test.state(), sent: test.sent}).includes('private-token-and-account'));
}
for (const delivery of ['sent', 'bounced', 'failed', 'unknown']) {
  const test = fixture([{state: 'active', runs: []}, {state: 'active', runs: [success(1)]}]);
  test.options.notifier.delivery = async () => delivery;
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false, 'accepted or failed delivery is not monitor success');
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  assert.equal(test.sent.length, 1, 'polling a pending delivery cannot resend');
  test.options.notifier.delivery = async () => 'delivered';
  assert.equal((await runBackupMonitor({...test.options, now: now + 30 * 60 * 1000})).monitorHealthy, true);
}
{
  const test = fixture([{state: 'active', runs: []}, {state: 'active', runs: [success(1)]}]);
  const keys = [];
  test.options.notifier.send = async (_message, key) => {keys.push(key); throw Error('secret-provider-response');};
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false);
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  assert.equal(keys[0], keys[1], 'an ambiguous send reuses its durable idempotency key');
  await runBackupMonitor({...test.options, now: now + 24 * 60 * 60 * 1000});
  assert.equal(keys.length, 2, 'uncertain sends are not replayed beyond the provider idempotency lifetime');
}
{
  const test = fixture();
  test.options.store.save = async () => {throw Error('state-unwritable');};
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false);
  assert.equal(test.pings.at(-1), false);
}
function githubFetch(runOverrides = {}, artifactOverrides = {}, responseOverride) {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({url: String(url), options});
    const path = new URL(url).pathname;
    let value;
    if (path.endsWith('/artifacts')) {
      const index = path.includes('/101/') ? 1 : 0;
      value = {total_count: 1, artifacts: success(index).artifacts.map(artifact => ({...artifact, ...artifactOverrides}))};
    } else if (path.endsWith('/runs')) {
      const index = path.includes('platform-backup') ? 1 : 0;
      const run = {...success(index)};
      delete run.artifacts;
      value = {total_count: 1, workflow_runs: [{...run, ...runOverrides}]};
    } else value = {state: 'active'};
    return responseOverride?.(url, value) ?? Response.json(value);
  };
  return {fetch, requests};
}
{
  const api = githubFetch();
  const test = fixture();
  test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).backupsHealthy, true, 'GitHub run/artifact metadata supplies verified backups');
  assert.equal(api.requests.length, 6);
  assert(api.requests.every(request => (request.options.method ?? 'GET') === 'GET' && new URL(request.url).origin === 'https://api.github.com'));
  assert(!api.requests.some(request => /download|logs|jobs/.test(request.url)), 'never fetch backup contents or job logs');
}
for (const overrides of [{updated_at: '2026-10-13T00:00:00Z'}, {updated_at: 'not-a-date'},
  {run_started_at: '2026-10-12T11:01:00Z'}, {created_at: null}, {id: '../secret'}, {run_attempt: 0}, {status: 'unknown'}]) {
  const api = githubFetch(overrides), test = fixture();
  test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false, 'invalid run metadata is inconclusive');
}
{
  const api = githubFetch({}, {created_at: '2026-10-12T11:01:00Z'}), test = fixture();
  test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).backupsHealthy, false, 'the artifact must be published before successful completion');
}
{
  const api = githubFetch({}, {}, url => String(url).includes('/auth-backup.yml') ? new Response('', {status: 404}) : undefined);
  const test = fixture(); test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).jobs[0].status, 'missing');
}
{
  const api = githubFetch({}, {}, (_url, value) => value.workflow_runs ? Response.json({...value, total_count: 600}) : undefined);
  const test = fixture(); test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false, 'truncated history cannot be healthy');
}
{
  const api = githubFetch({}, {}, (url, value) => {
    if (!value.artifacts) return;
    return Response.json({total_count: 101, artifacts: new URL(url).searchParams.get('page') === '1'
      ? Array.from({length: 100}, (_, i) => ({...value.artifacts[0], name: `unrelated-${i}`})) : value.artifacts});
  });
  const test = fixture(); test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).backupsHealthy, true, 'expected archives on later artifact pages are verified');
}
{
  const requests = [];
  const notifier = createResendNotifier({apiKey: 'synthetic-token', from: 'backups@example.com', to: 'operator@example.com', wait: async () => {},
    fetch: async (url, options) => {requests.push({url, options}); return Response.json(options.method === 'POST'
      ? {id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'} : {last_event: 'delivered'});}});
  const test = fixture([{state: 'active', runs: []}, {state: 'active', runs: [success(1)]}]);
  test.options.notifier = notifier;
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, true, 'Resend acceptance and delivered status complete the alert');
  const body = JSON.parse(requests[0].options.body);
  assert.deepEqual(Object.keys(body).sort(), ['from', 'subject', 'text', 'to']);
  assert.deepEqual(body.to, ['operator@example.com']);
  assert.equal(body.text, 'Job: Supabase Auth Backup\nStatus: Sicherung fehlt\nLetzte erfolgreiche Sicherung: keine verifiziert\nLink: https://github.com/ramiz4/riparim/actions/workflows/auth-backup.yml');
  assert.equal(requests[0].options.headers['Idempotency-Key'], 'auth-backup.yml-1791806400000-1-0');
  assert.equal(requests[1].url, 'https://api.resend.com/emails/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
}
{
  let calls = 0;
  const code = await runMonitorCli({env: {}, fetch: async () => {calls++; throw Error('not allowed');}, output: () => {}});
  assert.equal(code, 0, 'installation alone stays inactive');
  assert.equal(calls, 0);
}
{
  const pings = [], ping = createHeartbeat({url: 'https://hc-ping.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    fetch: async (url, options) => {pings.push({url, options}); return new Response('', {status: 200});}});
  await ping(true); await ping(false);
  assert.equal(pings[0].url, 'https://hc-ping.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(pings[1].url, 'https://hc-ping.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/fail');
  assert(pings.every(value => value.options.method === 'POST' && value.options.body === ''));
}
{
  const directory = await mkdtemp(join(tmpdir(), 'riparim-backup-monitor-'));
  try {
    const path = join(directory, 'state.json'), store = createFileStore({path});
    await store.save({version: 1, jobs: {}});
    assert.equal((await stat(path)).mode & 0o777, 0o600, 'state receipts remain private');
    assert.deepEqual(await store.load(), {version: 1, jobs: {}});
    await writeFile(path, '{bad-json', {mode: 0o600});
    const test = fixture(); test.options.store = store;
    assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false, 'corrupt state does not reset deduplication silently');
    assert.equal(await readFile(path, 'utf8'), '{bad-json');
  } finally {await rm(directory, {recursive: true, force: true});}
}
for (const state of [{version: 2, jobs: {}}, {version: 1, jobs: {'auth-backup.yml': {lastSuccessAt: '2026-10-13T00:00:00Z', incident: null, pending: null}}}]) {
  const test = fixture(); await test.options.store.save(state);
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false, 'invalid state is preserved and fails closed');
  assert.equal(test.sent.length, 0);
}
{
  const test = fixture([{state: 'active', runs: []}, {state: 'active', runs: [success(1)]}]);
  test.options.notifier.send = async () => {throw Error('offline');};
  await runBackupMonitor(test.options);
  test.state().jobs['auth-backup.yml'].pending.message.url = 'https://evil.example/private-account';
  const sent = []; test.options.notifier.send = async message => {sent.push(message); return 'receipt';};
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false);
  assert.equal(sent.length, 0, 'state corruption cannot inject external content into a notification');
}
for (const status of [401, 403, 429, 500]) {
  const api = githubFetch({}, {}, () => new Response('private-provider-content', {status}));
  const test = fixture(); test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false);
  assert(!JSON.stringify(test.state()).includes('private-provider-content'));
}
{
  const snapshots = [{state: 'active', runs: [success(0)]}, {state: 'active', runs: [success(1)]}];
  const test = fixture(snapshots);
  const read = test.options.readWorkflow;
  test.options.readWorkflow = async workflow => {if (workflow.file === workflows[0]) throw Error('offline'); return read(workflow);};
  await runBackupMonitor(test.options);
  test.options.readWorkflow = read;
  snapshots[0].runs.unshift(success(0, {id: 200, conclusion: 'failure', updated_at: '2026-10-12T11:59:00Z'}));
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  snapshots[0].runs.shift();
  const result = await runBackupMonitor({...test.options, now: now + 30 * 60 * 1000});
  assert.equal(result.backupsHealthy, false, 'removing a failed run or fixing API access cannot clear a real backup incident');
  assert(!test.sent.some(value => value.message.status === 'recovered'));
}
{
  const test = fixture(); test.options.heartbeat = async () => {throw Error('watchdog-offline');};
  const result = await runBackupMonitor(test.options);
  assert.equal(result.monitorHealthy, false);
  assert.equal(result.backupsHealthy, false, 'watchdog failure does not publish an overall healthy result');
}
console.log('Backup monitor: core, safe adapters/state, watchdog and inactive CLI passed');
{
  const api = githubFetch({}, {}, (url, value) => {
    if (!value.workflow_runs) return;
    const id = String(url).includes('platform') ? 400 : 200;
    return Response.json({total_count: 101, workflow_runs: new URL(url).searchParams.get('page') === '1'
      ? Array.from({length: 100}, (_, i) => ({...value.workflow_runs[0], id: id + i, status: 'queued', conclusion: null,
        created_at: '2026-10-12T11:55:00Z', run_started_at: '2026-10-12T11:55:00Z', updated_at: '2026-10-12T11:55:00Z'})) : value.workflow_runs});
  });
  const test = fixture(); test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).backupsHealthy, true, 'later run pages supply the last completed backup during tolerable queue delays');
}
for (const reply of [new Response('private-provider-error', {status: 429}), Response.json({}), Response.json({id: '../other-endpoint'})]) {
  const test = fixture([{state: 'active', runs: []}, {state: 'active', runs: [success(1)]}]);
  test.options.notifier = createResendNotifier({apiKey: 'synthetic-only', from: 'backups@example.com', to: 'operator@example.com', wait: async () => {}, fetch: async () => reply.clone()});
  const result = await runBackupMonitor(test.options);
  assert.equal(result.monitorHealthy, false);
  assert(!JSON.stringify({result, state: test.state()}).includes('private-provider-error'));
}
{
  const test = fixture([{state: 'active', runs: []}, {state: 'active', runs: [success(1)]}]);
  test.options.store.save = async () => {throw Error('disk-full');};
  await runBackupMonitor(test.options);
  assert.equal(test.sent.length, 0, 'an outbox that cannot be made durable prevents sending');
}
{
  const directory = await mkdtemp(join(tmpdir(), 'riparim-backup-monitor-lock-'));
  try {
    const path = join(directory, 'state.json'); await writeFile(path + '.lock', '', {mode: 0o600});
    const requests = [], outputs = [];
    const code = await runMonitorCli({env: {BACKUP_MONITOR_ENABLED: 'true', BACKUP_MONITOR_STATE_PATH: path,
      BACKUP_MONITOR_RESEND_API_KEY: 'synthetic-only', BACKUP_MONITOR_EMAIL_FROM: 'backups@example.com', BACKUP_MONITOR_EMAIL_TO: 'operator@example.com',
      BACKUP_MONITOR_HEARTBEAT_URL: 'https://hc-ping.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},
      fetch: async url => {requests.push(String(url)); return new Response('', {status: 200});}, output: value => outputs.push(value)});
    assert.equal(code, 1, 'a concurrent or stale lock is an operator-visible failure');
    assert.deepEqual(requests, ['https://hc-ping.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/fail']);
    assert.equal(await readFile(path + '.lock', 'utf8'), '', 'an invocation cannot delete another invocation lock');
    assert.deepEqual(outputs, [{status: 'monitor_error', monitorHealthy: false}]);
  } finally {await rm(directory, {recursive: true, force: true});}
}
{
  const snapshots = [{state: 'active', runs: [success(0)]}, {state: 'active', runs: [success(1)]}];
  const test = fixture(snapshots); await runBackupMonitor(test.options);
  const at = '2026-10-12T10:00:00Z';
  snapshots[0].runs = [success(0, {artifacts: []}), success(0, {id: 90, created_at: at, run_started_at: at, updated_at: at,
    artifacts: [{...success(0).artifacts[0], name: 'supabase-auth-90-1', created_at: at}]})];
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  assert.equal(test.sent[0].message.lastSuccessAt, '2026-10-12T11:00:00.000Z', 'lost artifact metadata must not roll back the last historically verified backup timestamp');
}
console.log('Backup monitor: pagination, provider failures, durable send fencing and concurrency passed');
{
  const snapshots = [{state: 'active', runs: [success(0)]}, {state: 'active', runs: [success(1)]}];
  const test = fixture(snapshots), read = test.options.readWorkflow;
  await runBackupMonitor(test.options);
  test.options.notifier.delivery = async () => 'unknown';
  test.options.readWorkflow = async workflow => {if (workflow.file === workflows[0]) throw Error('offline'); return read(workflow);};
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  const pending = structuredClone(test.state().jobs[workflows[0]].pending);
  test.options.readWorkflow = read;
  snapshots[0].runs.unshift(success(0, {id: 200, conclusion: 'failure', updated_at: '2026-10-12T11:59:00Z'}));
  await runBackupMonitor({...test.options, now: now + 30 * 60 * 1000});
  assert.equal(test.state().jobs[workflows[0]].incident.kind, 'failure', 'observe backup failures even while the monitor-error email is pending');
  assert.deepEqual(test.state().jobs[workflows[0]].pending, pending, 'incident observations cannot change the pending payload or retry key');
  snapshots[0].runs.shift();
  test.options.notifier.delivery = async () => 'delivered';
  await runBackupMonitor({...test.options, now: now + 45 * 60 * 1000});
  const result = await runBackupMonitor({...test.options, now: now + 60 * 60 * 1000});
  assert.equal(result.backupsHealthy, false, 'the old successful backup cannot recover the subsequently observed failure');
  assert(!test.sent.some(value => value.message.status === 'recovered'));
  assert(test.sent.length > 1, 'the delivered monitor-error receipt cannot mark the real backup incident as notified');
}
console.log('Backup monitor: pending monitor-error receipt cannot hide a backup failure passed');
{
  const snapshots = [{state: 'active', runs: [success(0, {id: 200, conclusion: 'failure', updated_at: '2026-10-12T11:59:00Z'}), success(0)]},
    {state: 'active', runs: [success(1)]}];
  const test = fixture(snapshots);
  await runBackupMonitor(test.options);
  const at = '2026-10-12T12:10:00Z';
  const recovered = success(0, {id: 300, created_at: at, run_started_at: at, updated_at: at,
    artifacts: [{...success(0).artifacts[0], name: 'supabase-auth-300-1', created_at: at}]});
  snapshots[0].runs = [recovered];
  test.options.notifier.delivery = async () => 'unknown';
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  const pending = structuredClone(test.state().jobs[workflows[0]].pending);
  assert.equal(pending.message.status, 'recovered');
  snapshots[0].runs.unshift(success(0, {id: 400, conclusion: 'failure', created_at: '2026-10-12T12:16:00Z',
    run_started_at: '2026-10-12T12:17:00Z', updated_at: '2026-10-12T12:20:00Z', artifacts: []}));
  await runBackupMonitor({...test.options, now: now + 30 * 60 * 1000});
  assert.deepEqual(test.state().jobs[workflows[0]].pending, pending, 'a new incident preserves the old recovery email and key');
  test.options.notifier.delivery = async () => 'delivered';
  await runBackupMonitor({...test.options, now: now + 45 * 60 * 1000});
  assert(test.state().jobs[workflows[0]].incident, 'an old recovery receipt cannot clear a subsequently observed failure');
  assert.equal(test.sent.at(-1).message.status, 'failure', 'the new backup incident gets its own alert after the old receipt is reconciled');
  snapshots[0].runs.shift();
  assert.equal((await runBackupMonitor({...test.options, now: now + 60 * 60 * 1000})).backupsHealthy, false,
    'removing the new failed run cannot turn the previous recovery backup into a new recovery');
}
console.log('Backup monitor: receipt bookkeeping is fenced to its observed incident passed');
for (const pendingStatus of ['cancelled', 'invalid_artifact', 'missing']) {
  const bad = pendingStatus === 'missing' ? [] : [success(0, {id: 200,
    conclusion: pendingStatus === 'invalid_artifact' ? 'success' : pendingStatus,
    updated_at: '2026-10-12T11:59:00Z', artifacts: []}), success(0)];
  const snapshots = [{state: 'active', runs: bad}, {state: 'active', runs: [success(1)]}];
  const test = fixture(snapshots);
  test.options.notifier.delivery = async () => 'unknown';
  await runBackupMonitor(test.options);
  const pending = structuredClone(test.state().jobs[workflows[0]].pending);
  assert.equal(pending.message.status, pendingStatus);
  const at = '2026-10-12T12:10:00Z';
  const recovered = success(0, {id: 300, created_at: at, run_started_at: at, updated_at: at,
    artifacts: [{...success(0).artifacts[0], name: 'supabase-auth-300-1', created_at: at}]});
  snapshots[0].runs = [recovered];
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  snapshots[0].runs.unshift(success(0, {id: 400, conclusion: 'failure', created_at: '2026-10-12T12:16:00Z',
    run_started_at: '2026-10-12T12:17:00Z', updated_at: '2026-10-12T12:20:00Z', artifacts: []}));
  await runBackupMonitor({...test.options, now: now + 30 * 60 * 1000});
  assert.deepEqual(test.state().jobs[workflows[0]].pending, pending, 'all pending alert types retain their immutable payload and key across later incidents');
  snapshots[0].runs.shift();
  test.options.notifier.delivery = async () => 'delivered';
  const result = await runBackupMonitor({...test.options, now: now + 45 * 60 * 1000});
  assert.equal(result.backupsHealthy, false);
  assert.equal(test.sent.length, 2, 'an older alert receipt does not suppress a subsequent incident alert');
  assert.equal(test.sent.at(-1).message.status, 'awaiting_backup');
  assert(!test.sent.some(value => value.message.status === 'recovered'), 'an unannounced successful interval cannot clear the later incident');
  const later = '2026-10-12T13:10:00Z';
  snapshots[0].runs = [success(0, {id: 500, created_at: later, run_started_at: later, updated_at: later,
    artifacts: [{...success(0).artifacts[0], name: 'supabase-auth-500-1', created_at: later}]})];
  assert.equal((await runBackupMonitor({...test.options, now: now + 75 * 60 * 1000})).backupsHealthy, true);
  assert.equal(test.sent.at(-1).message.status, 'recovered', 'a subsequent verified backup recovers the current incident');
}
{
  const snapshots = [{state: 'active', runs: []}, {state: 'active', runs: [success(1)]}];
  const test = fixture(snapshots), attempts = [];
  test.options.notifier.send = async (message, key) => {attempts.push({message: structuredClone(message), key}); throw Error('ambiguous-send');};
  await runBackupMonitor(test.options);
  const at = '2026-10-12T12:10:00Z';
  snapshots[0].runs = [success(0, {id: 300, created_at: at, run_started_at: at, updated_at: at,
    artifacts: [{...success(0).artifacts[0], name: 'supabase-auth-300-1', created_at: at}]})];
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  snapshots[0].runs.unshift(success(0, {id: 400, conclusion: 'failure', updated_at: '2026-10-12T12:20:00Z', artifacts: []}));
  await runBackupMonitor({...test.options, now: now + 30 * 60 * 1000});
  assert.deepEqual(attempts[1], attempts[0]); assert.deepEqual(attempts[2], attempts[0], 'provider retries preserve bytes and key despite later observed incidents');
  test.options.notifier.send = async (message, key) => {attempts.push({message: structuredClone(message), key}); return 'receipt';};
  await runBackupMonitor({...test.options, now: now + 45 * 60 * 1000});
  assert.deepEqual(attempts[3], attempts[0]);
  assert.notEqual(attempts[4].key, attempts[0].key, 'the actual current incident gets a distinct idempotency key');
  assert.equal(attempts[4].message.status, 'failure');
}
console.log('Backup monitor: pending alert variants and ambiguous-send retries preserve subsequent incidents passed');
for (const [status, conclusion, started, expected] of [
  ['completed', 'success', '2026-10-12T11:58:00Z', 'healthy'],
  ['completed', 'failure', '2026-10-12T11:58:00Z', 'failure'],
  ['in_progress', null, '2026-10-12T11:00:00Z', 'stuck'],
]) {
  const api = githubFetch({}, {}, (url, value) => {
    if (!value.workflow_runs) return;
    const rerun = {...value.workflow_runs[0], created_at: '2026-09-12T12:30:00Z', run_started_at: started,
      updated_at: '2026-10-12T11:59:00Z', status, conclusion, run_attempt: 2};
    const since = new URL(url).searchParams.get('created').slice(2);
    return Response.json({total_count: Date.parse(rerun.created_at) >= Date.parse(since) ? 1 : 0,
      workflow_runs: Date.parse(rerun.created_at) >= Date.parse(since) ? [rerun] : []});
  });
  const original = api.fetch;
  const fetch = async (url, options) => {
    const response = await original(url, options);
    if (!new URL(url).pathname.endsWith('/artifacts')) return response;
    const value = await response.json();
    return Response.json({...value, artifacts: value.artifacts.map(artifact => ({...artifact,
      name: artifact.name.replace(/-1$/, '-2'), created_at: '2026-10-12T11:58:30Z'}))});
  };
  const test = fixture(); test.options.readWorkflow = createGitHubReader({fetch, now});
  const result = await runBackupMonitor(test.options);
  assert.equal(result.jobs[0].status, expected, 'original run creation must not hide current attempts in GitHub’s allowed30day rerun window');
  assert(api.requests.filter(request => new URL(request.url).pathname.endsWith('/runs')).every(request =>
    new URL(request.url).searchParams.get('created') === '>=2026-09-10T12:00:00.000Z'));
}
console.log('Backup monitor: old-created current rerun attempts are included in the bounded window passed');
function queuedRetryFetch(status, started) {
  let updated = '2026-10-12T11:59:00Z';
  const api = githubFetch({}, {}, (url, value) => {
    const path = new URL(url).pathname;
    if (/\/runs\/200\/attempts\/2$/.test(path)) return Response.json({id: 200, run_attempt: 2,
      created_at: started, run_started_at: started});
    if (value.workflow_runs && String(url).includes('auth-backup.yml')) {
      const backup = {...value.workflow_runs[0], created_at: '2026-10-12T10:00:00Z',
        run_started_at: '2026-10-12T10:01:00Z', updated_at: '2026-10-12T10:05:00Z'};
      return Response.json({total_count: 2, workflow_runs: [{...backup, id: 200, run_attempt: 2,
        created_at: '2026-09-20T10:00:00Z', status, conclusion: null, run_started_at: started, updated_at: updated}, backup]});
    }
    if (value.artifacts && path.includes('/100/')) return Response.json({...value,
      artifacts: value.artifacts.map(artifact => ({...artifact, created_at: '2026-10-12T10:04:00Z'}))});
  });
  return {...api, update: value => {updated = value;}};
}
for (const status of ['queued', 'requested', 'waiting', 'pending']) {
  for (const [started, expected] of [['2026-10-12T11:55:00Z', 'healthy'], ['2026-10-12T10:00:01Z', 'healthy'],
    ['2026-10-12T10:00:00Z', 'stuck']]) {
    const api = queuedRetryFetch(status, started), test = fixture();
    test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
    assert.equal((await runBackupMonitor(test.options)).jobs[0].status, expected,
      `${status} retry age follows its current attempt, not original creation`);
  }
  for (const [started, expected] of [['2026-10-12T10:00:01Z', 'healthy'], ['2026-10-12T10:00:00Z', 'stuck']]) {
    const run = success(0, {id: 200, status, conclusion: null, created_at: started, run_started_at: null,
      updated_at: '2026-10-12T11:59:00Z', artifacts: []});
    const test = fixture([{state: 'active', runs: [run, success(0)]}, {state: 'active', runs: [success(1)]}]);
    assert.equal((await runBackupMonitor(test.options)).jobs[0].status, expected, `${status} first-attempt queues retain creation-based grace`);
  }
}
console.log('Backup monitor: queue grace follows the current retry attempt passed');
for (const status of ['queued', 'requested', 'waiting', 'pending']) {
  for (const absent of ['missing_timestamp', 'original_timestamp', 'missing_attempt']) {
    const api = queuedRetryFetch(status, '2026-09-20T10:01:00Z'), test = fixture();
    const fetch = async (url, options) => {
      const response = await api.fetch(url, options);
      if (!/\/runs\/200\/attempts\/2$/.test(new URL(url).pathname)) return response;
      if (absent === 'missing_attempt') return new Response('', {status: 404});
      return Response.json({id: 200, run_attempt: 2, created_at: absent === 'original_timestamp' ? '2026-09-20T10:00:00Z' : null,
        run_started_at: '2026-09-20T10:01:00Z'});
    };
    async function check(at) {
      api.update(new Date(at).toISOString());
      return runBackupMonitor({...test.options, now: at, readWorkflow: createGitHubReader({fetch, now: at})});
    }
    assert.equal((await check(now)).jobs[0].status, 'healthy', 'ambiguous retry timestamps start a conservative observation grace');
    assert.equal((await check(now + 119 * 60 * 1000)).jobs[0].status, 'healthy');
    assert.equal((await check(now + 120 * 60 * 1000)).jobs[0].status, 'stuck',
      'durable first observation survives new invocations and updated_at churn');
  }
}
console.log('Backup monitor: ambiguous queue timestamps use durable observation grace passed');
{
  const api = queuedRetryFetch('queued', '2026-09-20T10:01:00Z'), test = fixture();
  const fetch = async (url, options) => {
    const response = await api.fetch(url, options);
    return /\/runs\/200\/attempts\/2$/.test(new URL(url).pathname)
      ? Response.json({id: 200, run_attempt: 2, created_at: '2026-10-12T11:55:00Z', run_started_at: '2026-10-12T11:54:59Z'}) : response;
  };
  test.options.readWorkflow = createGitHubReader({fetch, now});
  assert.equal((await runBackupMonitor(test.options)).jobs[0].status, 'healthy',
    'attempt-specific creation is current even if the parent retains its original start and the attempt start precedes creation by one second');
}
for (const invalid of [401, 403, 429, 500, {id: 999, run_attempt: 2, created_at: '2026-10-12T11:55:00Z'},
  {id: 200, run_attempt: 1, created_at: '2026-10-12T11:55:00Z'}, {id: 200, run_attempt: 2, created_at: 'private-invalid-timestamp'},
  {id: 200, run_attempt: 2, created_at: '2026-10-13T00:00:00Z'}]) {
  const api = queuedRetryFetch('queued', '2026-10-12T11:55:00Z'), test = fixture();
  const fetch = async (url, options) => {
    const response = await api.fetch(url, options);
    if (!/\/runs\/200\/attempts\/2$/.test(new URL(url).pathname)) return response;
    return typeof invalid === 'number' ? new Response('private-attempt-error', {status: invalid}) : Response.json(invalid);
  };
  test.options.readWorkflow = createGitHubReader({fetch, now});
  const result = await runBackupMonitor(test.options);
  assert.equal(result.monitorHealthy, false, 'attempt metadata failures remain inconclusive');
  assert.equal(result.jobs[0].status, 'monitor_error');
  assert(!JSON.stringify({result, state: test.state()}).includes('private-'));
}
{
  let queued = true;
  const api = githubFetch({}, {}, (url, value) => {
    const match = /\/runs\/(\d+)\/attempts\/2$/.exec(new URL(url).pathname);
    if (match) return Response.json({id: Number(match[1]), run_attempt: 2, created_at: null});
    if (queued && value.workflow_runs && String(url).includes('auth-backup.yml')) return Response.json({total_count: 101,
      workflow_runs: new URL(url).searchParams.get('page') === '1' ? Array.from({length: 100}, (_, index) => ({...value.workflow_runs[0], id: 200 + index, run_attempt: 2,
        created_at: '2026-09-20T10:00:00Z', run_started_at: '2026-09-20T10:01:00Z', updated_at: '2026-10-12T11:59:00Z',
        status: 'queued', conclusion: null})) : value.workflow_runs});
  });
  const test = fixture(); test.options.readWorkflow = createGitHubReader({fetch: api.fetch, now});
  assert.equal((await runBackupMonitor(test.options)).backupsHealthy, true);
  assert.equal(api.requests.filter(request => /\/attempts\/2$/.test(new URL(request.url).pathname)).length, 20, 'queue-attempt metadata reads are bounded per workflow');
  assert.equal(Object.keys(test.state().jobs[workflows[0]].queueStartedAt).length, 100);
  queued = false;
  await runBackupMonitor({...test.options, now: now + 15 * 60 * 1000});
  assert.deepEqual(test.state().jobs[workflows[0]].queueStartedAt, {}, 'observations are pruned when attempts leave the queued snapshot');
}
{
  const test = fixture(); await runBackupMonitor(test.options);
  test.state().jobs[workflows[0]].queueStartedAt = Object.fromEntries(Array.from({length: 501}, (_, index) => [`${200 + index}-2`, now]));
  assert.equal((await runBackupMonitor(test.options)).monitorHealthy, false, 'persisted queue observations cannot exceed the workflow history bound');
}
console.log('Backup monitor: retry metadata failures, bounded reads and pruned durable observations passed');
{
  const savedClock = Date.now;
  let clock = now;
  try {
    Date.now = () => clock;
    const api = queuedRetryFetch('queued', '2026-10-12T12:00:01Z'), test = fixture();
    api.update('2026-10-12T12:00:02Z');
    const options = {...test.options}; delete options.now;
    options.readWorkflow = createGitHubReader({fetch: async (url, config) => {
      if (new URL(url).pathname.endsWith('/auth-backup.yml/runs')) clock = now + 3000;
      return api.fetch(url, config);
    }});
    const result = await runBackupMonitor(options);
    assert.equal(result.monitorHealthy, true);
    assert.equal(result.backupsHealthy, true, 'a current attempt created during API reads is assessed against the refreshed real clock');
  } finally {Date.now = savedClock;}
}
console.log('Backup monitor: assessment clock advances with metadata reads passed');
