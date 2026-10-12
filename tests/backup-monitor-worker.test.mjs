import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {decodeMonitorState, encodeMonitorState} from '../scripts/lib/backup-monitor-state.mjs';
import {createFileStore, createGitHubReader, createHeartbeat, createResendNotifier, runBackupMonitor, runMonitorCli} from '../scripts/monitor-backups.mjs';

const built = await build({entryPoints: ['monitor/worker.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers']});
const directory = await mkdtemp(join(tmpdir(), 'riparim-monitor-worker-'));
const token = 'synthetic-monitor-transfer-token-000000000000';
let outbound = 0;
const runtime = new Miniflare({modules: true, script: built.outputFiles[0].text, compatibilityDate: '2026-05-22',
  bindings: {BACKUP_MONITOR_ENABLED: 'false', BACKUP_MONITOR_PAUSED: 'true', BACKUP_MONITOR_TRANSFER_TOKEN: token},
  durableObjects: {BACKUP_MONITOR: {className: 'BackupMonitor', useSQLite: true}}, durableObjectsPersist: join(directory, 'sqlite'),
  outboundService: async () => {outbound++; throw Error('default disabled Worker cannot contact providers');}});
try {
  const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
  const text = encodeMonitorState({version: 1, jobs: {}});
  const imported = await runtime.dispatchFetch('https://monitor.example/state', {method: 'PUT', headers, body: text});
  assert.equal(imported.status, 201, 'authenticated paused Worker can import a portable checkpoint');
  assert.equal(outbound, 0, 'state transfer cannot call monitoring providers');
  assert.equal((await runtime.dispatchFetch('https://monitor.example/state', {headers: {Authorization: token}})).status, 403,
    'the bare transfer secret is not an Authorization scheme');
} finally {await runtime.dispose(); await rm(directory, {recursive: true, force: true});}
console.log('Backup monitor Worker: actual SQLite state transfer passed');

const fixture = await build({stdin: {resolveDir: process.cwd(), loader: 'ts', contents: `
import worker, {BackupMonitor as Monitor} from './monitor/worker';
export class BackupMonitor extends Monitor {
  constructor(ctx, env) {super(ctx, env); const put=ctx.storage.put.bind(ctx.storage);
    ctx.storage.put=(...args)=>{if(this.failWrites)throw Error('simulated storage unavailable');return put(...args);};}
  async failStorage(value) {this.failWrites=value;}
  async corrupt(text) {await this.ctx.storage.put('monitor-state',text);}
}
export default {async fetch(request,env,ctx) {
  const url=new URL(request.url);
  if(url.pathname==='/__test/fail-storage'){await env.BACKUP_MONITOR.getByName('ramiz4/riparim').failStorage(true);return new Response('ok');}
  if(url.pathname==='/__test/corrupt'){await env.BACKUP_MONITOR.getByName('ramiz4/riparim').corrupt('{bad-json');return new Response('ok');}
  if(url.pathname==='/__test/scheduled'){const tasks=[];await worker.scheduled({cron:url.searchParams.get('cron'),scheduledTime:Date.now()},env,{waitUntil(p){tasks.push(p);ctx.waitUntil(p);}});await Promise.all(tasks);return new Response('ok');}
  return worker.fetch(request,env,ctx);
}};`}, bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers']});
const root = await mkdtemp(join(tmpdir(), 'riparim-monitor-runtime-'));
const bindings = {BACKUP_MONITOR_ENABLED: 'true', BACKUP_MONITOR_PAUSED: 'false', BACKUP_MONITOR_SCHEDULE: '*/15 * * * *',
  BACKUP_MONITOR_TRANSFER_TOKEN: token, BACKUP_MONITOR_RESEND_API_KEY: 'synthetic-resend-key', BACKUP_MONITOR_EMAIL_FROM: 'backups@example.com',
  BACKUP_MONITOR_EMAIL_TO: 'operator@example.com', BACKUP_MONITOR_HEARTBEAT_URL: 'https://hc-ping.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'};
function provider() {
  const state = {mode: 'healthy', delivery: 'delivered', at: Date.now() - 3600000, id: 100, ambiguous: false, heavy: false,
    delay: 0, redirect: false, calls: [], mails: new Map(), posts: [], pings: []};
  state.respond = async request => {
    const url = new URL(request.url); state.calls.push(url.href);
    if (state.delay && url.hostname === 'api.github.com') await new Promise(resolve => setTimeout(resolve, state.delay));
    const auth = url.pathname.includes('auth-backup');
    if (url.hostname === 'hc-ping.com') {state.pings.push(url.pathname); return new Response('ok');}
    if (url.hostname === 'api.resend.com') {
      if (request.method === 'POST') {
        const key = request.headers.get('Idempotency-Key'), body = await request.json(); state.posts.push({key, body});
        assert.deepEqual(Object.keys(body).sort(), ['from', 'subject', 'text', 'to']);
        const existing = state.mails.get(key);
        if (existing) {assert.deepEqual(body, existing.body); return Response.json({id: existing.id});}
        const id = `aaaaaaaa-bbbb-cccc-dddd-${String(state.mails.size + 1).padStart(12, '0')}`;
        state.mails.set(key, {id, body});
        if (state.ambiguous) {state.ambiguous = false; return new Response('synthetic private provider error', {status: 500});}
        return Response.json({id});
      }
      return Response.json({last_event: state.delivery});
    }
    if (url.hostname !== 'api.github.com') throw Error('Unexpected outbound destination.');
    if (state.redirect) return new Response(null, {status: 302, headers: {Location: 'https://unexpected.example/metadata'}});
    if (url.pathname.endsWith('/runs')) {
      if (state.heavy) return Response.json({total_count: 100, workflow_runs: Array.from({length: 100}, (_, index) => ({id: 200 + index, run_attempt: 2,
        status: 'queued', conclusion: null, head_branch: 'main', created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        run_started_at: new Date(Date.now() - 4 * 86400000).toISOString(), updated_at: new Date(Date.now() - 1000).toISOString()}))});
      const id = auth ? state.id : 101, at = auth ? state.at : Date.now() - 3600000;
      const successful = {id, run_attempt: 1, status: 'completed', conclusion: 'success', head_branch: 'main',
        created_at: new Date(at - 60000).toISOString(), run_started_at: new Date(at - 30000).toISOString(), updated_at: new Date(at).toISOString()};
      const runs = auth && state.mode === 'missing' ? [] : [successful];
      if (auth && state.mode === 'failure') runs.unshift({...successful, id: 400, created_at: new Date(Date.now() - 10000).toISOString(),
        run_started_at: new Date(Date.now() - 8000).toISOString(), updated_at: new Date(Date.now() - 5000).toISOString(), conclusion: 'failure'});
      return Response.json({total_count: runs.length, workflow_runs: runs});
    }
    const attempt = /\/runs\/(\d+)\/attempts\/2$/.exec(url.pathname);
    if (attempt) return Response.json({id: Number(attempt[1]), run_attempt: 2, created_at: new Date(Date.now() - 60000).toISOString()});
    if (url.pathname.endsWith('/artifacts')) {
      const id = Number(url.pathname.split('/').at(-2)), at = id === 101 ? Date.now() - 3600000 : state.at;
      return Response.json({total_count: 1, artifacts: [{name: `${id === 101 ? 'platform' : 'supabase-auth'}-${id}-1`, expired: false, size_in_bytes: 100,
        created_at: new Date(at - 1000).toISOString(), expires_at: new Date(at + 14 * 86400000).toISOString()}]});
    }
    return Response.json({state: 'active'});
  };
  state.fetch = (input, options) => state.respond(input instanceof Request ? input : new Request(input, options));
  return state;
}
function start(name, env, fake, script = fixture.outputFiles[0].text) {
  return new Miniflare({modules: true, script, compatibilityDate: '2026-05-22', bindings: env,
    durableObjects: {BACKUP_MONITOR: {className: 'BackupMonitor', useSQLite: true}}, durableObjectsPersist: join(root, name), outboundService: request => fake.respond(request)});
}
const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
const request = (runtime, path = '/run', options = {}) => runtime.dispatchFetch(`https://monitor.example${path}`, {method: 'POST', headers, ...options});
async function sqliteFiles(path) {
  let files; try {files = await readdir(path, {withFileTypes: true});} catch (error) {if (error.code === 'ENOENT') return []; throw error;}
  return (await Promise.all(files.map(file => file.isDirectory() ? sqliteFiles(join(path, file.name)) : /\.sqlite/.test(file.name) ? [file.name] : []))).flat();
}
try {
  for (const [field, value] of [['BACKUP_MONITOR_ENABLED', 'false'], ['BACKUP_MONITOR_PAUSED', 'true'], ['BACKUP_MONITOR_SCHEDULE', ''],
    ['BACKUP_MONITOR_RESEND_API_KEY', undefined], ['BACKUP_MONITOR_EMAIL_TO', undefined], ['BACKUP_MONITOR_HEARTBEAT_URL', undefined], ['BACKUP_MONITOR_TRANSFER_TOKEN', undefined]]) {
    const fake = provider(), env = {...bindings}; if (value === undefined) delete env[field]; else env[field] = value;
    const name = `inactive-${field}`, runtime = start(name, env, fake);
    try {
      await runtime.ready;
      const before = await sqliteFiles(join(root, name));
      const response = await request(runtime); assert.notEqual((await response.json()).monitorHealthy, true);
      assert.equal(fake.calls.length, 0); assert.deepEqual(await sqliteFiles(join(root, name)), before, 'inactive/unconfigured monitoring never creates object storage beyond Miniflare metadata');
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(), runtime = start('concurrency', bindings, fake); fake.mode = 'missing'; fake.delay = 20;
    try {
      const responses = await Promise.all([request(runtime), request(runtime)]);
      const payloads = await Promise.all(responses.map(response => response.json()));
      assert(responses.every(response => response.status === 200), JSON.stringify(payloads));
      assert.equal(fake.mails.size, 1, 'overlapping RPC checks share one monitor invocation and one durable alert');
      assert.equal(fake.posts.length, 1);
      assert.equal((await request(runtime, '/state', {method: 'GET'})).status, 409, 'active monitoring cannot export state');
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(); fake.mode = 'missing'; fake.ambiguous = true;
    let runtime = start('restart', bindings, fake);
    const first = await request(runtime); assert.equal(first.status, 503); assert.equal(fake.mails.size, 1);
    const pending = fake.posts[0]; await runtime.dispose();
    runtime = start('restart', bindings, fake);
    try {
      assert.equal((await request(runtime)).status, 200);
      assert.equal(fake.mails.size, 1, 'SQLite restart reuses the accepted notification key');
      assert.equal(fake.posts.length, 2); assert.deepEqual(fake.posts[1], pending);
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(), runtime = start('corrupt', bindings, fake);
    try {
      await request(runtime, '/__test/corrupt');
      assert.equal((await request(runtime)).status, 503);
      assert.equal(fake.posts.length, 0); assert(fake.pings.at(-1).endsWith('/fail'), 'corrupt SQLite state cannot produce a success heartbeat');
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(), runtime = start('storage-failure', bindings, fake); fake.mode = 'missing';
    try {
      await request(runtime, '/__test/fail-storage');
      assert.equal((await request(runtime)).status, 503);
      assert.equal(fake.posts.length, 0, 'failed durable outbox write fences external email sending');
      assert(fake.pings.at(-1).endsWith('/fail'));
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(), runtime = start('budget', bindings, fake); fake.heavy = true;
    try {
      const result = await (await request(runtime)).json();
      assert.equal(result.monitorHealthy, false); assert.equal(result.backupsHealthy, false);
      assert(fake.calls.length <= 45, 'Cloudflare Free external requests remain below50');
      assert(fake.pings.at(-1).endsWith('/fail'), 'the reserved failure heartbeat survives budget exhaustion');
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(), runtime = start('redirect', bindings, fake); fake.redirect = true;
    try {
      assert.equal((await request(runtime)).status, 503);
      assert(fake.calls.every(url => new URL(url).hostname !== 'unexpected.example'), 'portable manual redirects never follow or forward credentials');
      assert(fake.pings.at(-1).endsWith('/fail'));
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(), runtime = start('scheduled', bindings, fake);
    try {
      assert.equal((await request(runtime, '/__test/scheduled?cron=wrong')).status, 200); assert.equal(fake.calls.length, 0);
      assert.equal((await request(runtime, '/__test/scheduled?cron=' + encodeURIComponent('*/15 * * * *'))).status, 200);
      assert.equal(fake.pings.length, 1);
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(); fake.delay = 100;
    const script = `const originalTimer=globalThis.setTimeout;globalThis.setTimeout=(callback,delay,...args)=>originalTimer(callback,Math.min(delay,50),...args);\n` + fixture.outputFiles[0].text;
    const runtime = start('wall-time', bindings, fake, script);
    try {
      assert.equal((await request(runtime)).status, 503);
      assert(fake.pings.at(-1).endsWith('/fail'), 'the wall-time deadline preserves a separately timed failure heartbeat');
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(), paused = {...bindings, BACKUP_MONITOR_ENABLED: 'false', BACKUP_MONITOR_PAUSED: 'true'};
    const runtime = start('transfer-guards', paused, fake);
    try {
      const text = encodeMonitorState({version: 1, jobs: {}});
      const results = await Promise.all([request(runtime, '/state', {method: 'PUT', body: text}), request(runtime, '/state', {method: 'PUT', body: text})]);
      assert.deepEqual(results.map(response => response.status).sort(), [201, 409], 'concurrent imports cannot replace one another');
      const before = await (await request(runtime, '/state', {method: 'GET'})).text();
      for (const body of [JSON.stringify({...JSON.parse(text), repository: 'foreign/repo'}), '{bad-json', 'x'.repeat(128 * 1024 + 1)]) {
        assert.equal((await request(runtime, '/state', {method: 'PUT', headers: {...headers, 'X-Monitor-Replace': 'true'}, body})).status, 400);
        assert.equal(await (await request(runtime, '/state', {method: 'GET'})).text(), before);
      }
      assert.equal((await request(runtime, '/state', {method: 'PUT', headers: {...headers, 'X-Monitor-Replace': 'true'}, body: text})).status, 201);
      assert.equal((await request(runtime, '/state', {method: 'GET', headers: {Authorization: `Bearer ${'x'.repeat(257)}`}})).status, 403);
      assert.equal(fake.calls.length, 0);
    } finally {await runtime.dispose();}
  }
  {
    const fake = provider(); fake.mode = 'missing'; fake.delivery = 'unknown';
    const source = join(root, 'node-source.json'), target = join(root, 'node-target.json'), transferFile = join(root, 'portable.json');
    const node = path => runBackupMonitor({readWorkflow: createGitHubReader({fetch: fake.fetch}), store: createFileStore({path}),
      notifier: createResendNotifier({fetch: fake.fetch, apiKey: bindings.BACKUP_MONITOR_RESEND_API_KEY, from: bindings.BACKUP_MONITOR_EMAIL_FROM, to: bindings.BACKUP_MONITOR_EMAIL_TO}),
      heartbeat: createHeartbeat({fetch: fake.fetch, url: bindings.BACKUP_MONITOR_HEARTBEAT_URL})});
    assert.equal((await node(source)).monitorHealthy, false);
    const original = (await createFileStore({path: source}).load()).jobs['auth-backup.yml'].pending;
    const paused = {...bindings, BACKUP_MONITOR_ENABLED: 'false', BACKUP_MONITOR_PAUSED: 'true'};
    assert.equal(await runMonitorCli({env: {...paused, BACKUP_MONITOR_STATE_PATH: source}, args: ['export-state', transferFile], output: () => {}}), 0);
    let runtime = start('portable', paused, fake);
    assert.equal((await request(runtime, '/state', {method: 'PUT', body: await readFile(transferFile, 'utf8')})).status, 201);
    await runtime.dispose();
    fake.mode = 'failure';
    runtime = start('portable', bindings, fake);
    assert.equal((await request(runtime)).status, 503);
    assert.equal(fake.posts.length, 1, 'Worker resume polls the imported unresolved receipt instead of resending');
    await runtime.dispose();
    runtime = start('portable', paused, fake);
    const returned = await (await request(runtime, '/state', {method: 'GET'})).text();
    const state = decodeMonitorState(returned);
    assert.deepEqual(state.jobs['auth-backup.yml'].pending, original);
    assert.equal(state.jobs['auth-backup.yml'].incident.kind, 'failure', 'a newer incident survives portable transfer');
    await runtime.dispose();
    const returnedFile = join(root, 'returned.json'); await createFileStore({path: returnedFile}).save(JSON.parse(returned));
    assert.equal(await runMonitorCli({env: {...paused, BACKUP_MONITOR_STATE_PATH: target}, args: ['import-state', returnedFile], output: () => {}}), 0);
    fake.mode = 'healthy';
    assert.equal((await node(target)).monitorHealthy, false);
    assert.equal(fake.posts.length, 1, 'Node resume retains the Worker receipt and key');
    fake.delivery = 'delivered';
    const stillFailed = await node(target);
    assert.equal(stillFailed.backupsHealthy, false, 'old receipt delivery cannot recover the newer incident');
    assert.equal(fake.mails.size, 2, 'the newer incident receives exactly one alert');
    fake.id = 300; fake.at = Date.now();
    assert.equal((await node(target)).backupsHealthy, true);
    assert.equal((await createFileStore({path: target}).load()).jobs['auth-backup.yml'].incident, null);
    assert.equal(fake.mails.size, 3, 'a verified new backup delivers one recovery');
  }
} finally {await rm(root, {recursive: true, force: true});}
console.log('Backup monitor Worker: real runtime inactivity, concurrency, restart, storage/transport limits and scheduled handler passed');
