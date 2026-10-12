import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFileStore, runMonitorCli} from '../scripts/monitor-backups.mjs';
import {runBackupMonitor} from '../scripts/lib/backup-monitor-core.mjs';
import {decodeMonitorState, encodeMonitorState} from '../scripts/lib/backup-monitor-state.mjs';

const now = Date.parse('2026-10-12T12:00:00Z');
const names = ['Supabase Auth Backup', 'Platform Backup'];
function snapshot(workflow) {
  const id = workflow.file === 'auth-backup.yml' ? 100 : 101;
  return {state: 'active', runs: [{id, run_attempt: 1, status: 'completed', conclusion: 'success', head_branch: 'main',
    created_at: '2026-10-12T10:55:00Z', run_started_at: '2026-10-12T10:56:00Z', updated_at: '2026-10-12T11:00:00Z',
    artifacts: [{name: `${workflow.prefix}-${id}-1`, expired: false, size_in_bytes: 100,
      created_at: '2026-10-12T10:59:00Z', expires_at: '2026-10-26T10:59:00Z'}]}]};
}
let state;
const result = await runBackupMonitor({now, readWorkflow: async workflow => snapshot(workflow),
  store: {load: async () => structuredClone(state), save: async value => {state = structuredClone(value);}},
  notifier: {send: async () => {throw Error('healthy backup does not notify');}, delivery: async () => 'delivered'}, heartbeat: async () => {}});
assert.equal(result.backupsHealthy, true, 'the shared core runs monitor behavior independently of Node adapters');
assert.deepEqual(result.jobs.map(job => job.job), names);
const bundle = await build({entryPoints: ['scripts/lib/backup-monitor-core.mjs'], bundle: true, platform: 'neutral', format: 'esm', write: false});
assert(!/node:|require\("(?:fs|path|crypto|timers)"\)/.test(bundle.outputFiles[0].text), 'the monitor core uses only portable platform APIs');
console.log('Backup monitor: provider-neutral core behavior and bundle passed');
let pending;
await runBackupMonitor({now, readWorkflow: async workflow => workflow.file === 'auth-backup.yml' ? {state: 'active', runs: []} : snapshot(workflow),
  store: {load: async () => structuredClone(pending), save: async value => {pending = structuredClone(value);}},
  notifier: {send: async () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', delivery: async () => 'unknown'}, heartbeat: async () => {}});
const transfer = encodeMonitorState(pending, {now});
assert.deepEqual(decodeMonitorState(transfer, {now}), pending, 'portable transfer retains pending receipt/payload/key, incident generation and queue observations');
const envelope = JSON.parse(transfer);
assert.equal(envelope.repository, 'ramiz4/riparim');
for (const change of [value => {value.repository = 'foreign/repository';}, value => {value.version = 2;},
  value => {value.state.account = 'private-account';}, value => {value.state.jobs['auth-backup.yml'].pending.message.contents = 'private-document';},
  value => {value.state.jobs['auth-backup.yml'].pending.message.status = 'constructor';},
  value => {value.state.jobs['auth-backup.yml'].pending.key = 'auth-backup.yml-1791806400000-999-0';},
  value => {value.state.jobs['auth-backup.yml'].pending.key = 'auth-backup.yml-1791806400000-1-recovered';},
  value => {value.state.jobs['auth-backup.yml'].lastSuccessAt = '2026-10-13T00:00:00Z';}]) {
  const value = structuredClone(envelope); change(value);
  assert.throws(() => decodeMonitorState(JSON.stringify(value), {now}));
}
assert.throws(() => decodeMonitorState('x'.repeat(128 * 1024 + 1), {now}));
assert.throws(() => decodeMonitorState('{invalid', {now}));
console.log('Backup monitor: strict portable state boundary passed');
const directory = await mkdtemp(join(tmpdir(), 'riparim-monitor-transfer-'));
try {
  const source = join(directory, 'source.json'), target = join(directory, 'target.json'), file = join(directory, 'transfer.json');
  await createFileStore({path: source}).save(pending);
  const output = [], env = {BACKUP_MONITOR_ENABLED: 'false', BACKUP_MONITOR_PAUSED: 'true', BACKUP_MONITOR_STATE_PATH: source};
  const fetch = async () => {throw Error('state transfer cannot contact monitoring providers');};
  assert.equal(await runMonitorCli({env, args: ['export-state', file], fetch, output: value => output.push(value)}), 0);
  assert.equal(output.at(-1).status, 'exported', 'paused Node export is an explicit operational command');
  assert.deepEqual(decodeMonitorState(await readFile(file, 'utf8')), pending);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const destination = {...env, BACKUP_MONITOR_STATE_PATH: target};
  assert.equal(await runMonitorCli({env: destination, args: ['import-state', file], fetch, output: value => output.push(value)}), 0);
  assert.deepEqual(await createFileStore({path: target}).load(), pending);
  assert.equal(await runMonitorCli({env: destination, args: ['import-state', file], fetch, output: () => {}}), 1, 'existing state cannot be replaced implicitly');
  assert.equal(await runMonitorCli({env: destination, args: ['import-state', file, '--replace'], fetch, output: () => {}}), 0);
  const before = await readFile(target, 'utf8');
  await writeFile(file, JSON.stringify({...JSON.parse(transfer), repository: 'foreign/repo'}), {mode: 0o600});
  assert.equal(await runMonitorCli({env: destination, args: ['import-state', file, '--replace'], fetch, output: () => {}}), 1);
  assert.equal(await readFile(target, 'utf8'), before, 'invalid transfer cannot damage the destination');
  assert.equal(await runMonitorCli({env: {...env, BACKUP_MONITOR_ENABLED: 'true', BACKUP_MONITOR_PAUSED: 'false'},
    args: ['export-state', join(directory, 'active.json')], fetch, output: () => {}}), 1, 'active monitoring cannot transfer state');
} finally {await rm(directory, {recursive: true, force: true});}
console.log('Backup monitor: paused private Node import/export and overwrite fencing passed');
