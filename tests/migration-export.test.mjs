import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

const token='a'.repeat(64), hash=createHash('sha256').update(token).digest('hex'), commit='b'.repeat(40);
let passed=0;
for(const workerPath of ['./build/sites-worker','./build/cloudflare-worker']) {
 const bundle=await build({stdin:{contents:`import worker from '${workerPath}';export default worker;`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers','node:async_hooks'],define:{'import.meta.env.DEV':'false',__RIPARIM_RELEASE_COMMIT__:JSON.stringify(commit)},plugins:[{name:'isolated-migration',setup(b){
  b.onResolve({filter:/(?:notifications\/outbox|^\.\/outbox)$/},args=>({path:args.path,namespace:'scheduled'}));
  b.onLoad({filter:/.*/,namespace:'scheduled'},()=>({loader:'js',contents:'export async function processNotifications(){throw Error("Scheduled writes must remain frozen");}'}));
  b.onResolve({filter:/^vinext\/server\/fetch-handler$/},args=>({path:args.path,namespace:'application'}));
  b.onLoad({filter:/.*/,namespace:'application'},()=>({loader:'js',contents:`import {env} from 'cloudflare:workers';export default {async fetch(){await env.DB.prepare("INSERT INTO application_writes DEFAULT VALUES").run();return new Response('application');}};`}));
 }}]});
 const make=extra=>new Miniflare({modules:true,unsafeTriggerHandlers:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{MIGRATION_READ_ONLY:'true',MIGRATION_EXPORT_TOKEN_SHA256:hash,MIGRATION_EXPORT_EXPIRES_AT:new Date(Date.now()+3600_000).toISOString(),MIGRATION_SOURCE_COMMIT:commit,...extra}});
 const runtime=make({});
 try {
  const db=await runtime.getD1Database('DB'),bucket=await runtime.getR2Bucket('BUCKET');
  await db.prepare('CREATE TABLE application_writes(id INTEGER PRIMARY KEY)').run();
  await db.prepare('CREATE TABLE accounts(id TEXT PRIMARY KEY, secret BLOB, status TEXT)').run();
  for(let i=0;i<8;i++) await db.prepare('INSERT INTO accounts VALUES (?,?,?)').bind('fixture-'+i,new Uint8Array([0,255,i]),'blocked').run();
  await db.prepare('CREATE TABLE "without" (id TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID').run();
  await db.prepare('INSERT INTO "without" VALUES (?,?)').bind('fixture','native-owner-unchanged').run();
  await bucket.put('private/fixture.bin',new Uint8Array([0,1,255]),{httpMetadata:{contentType:'application/x-fixture'},customMetadata:{owner:'fixture-only'}});
  const call=(operation,query={})=>runtime.dispatchFetch('http://fixture/__migration/export?'+new URLSearchParams({operation,...query}),{headers:{Authorization:'Bearer '+token}});
  for(const method of ['GET','POST','DELETE']) {const blocked=await runtime.dispatchFetch('http://fixture/api/visits',{method});assert.equal(blocked.status,503);assert.equal(blocked.headers.get('X-Riparim-Migration-Read-Only'),'true');assert.equal(blocked.headers.get('X-Riparim-Release-Commit'),commit);passed++;}
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM application_writes').first()).n,0);passed++;
  const scheduled=await runtime.dispatchFetch('http://fixture/cdn-cgi/handler/scheduled?cron=*+*+*+*+*');assert(scheduled.ok);passed++;
  for(const Authorization of [undefined,'Bearer wrong','Bearer '+hash]) {assert.equal((await runtime.dispatchFetch('http://fixture/__migration/export?operation=schema',{headers:Authorization?{Authorization}:{}})).status,404);passed++;}
  const meta=await (await call('schema')).json();assert.equal(meta.sourceCommit,commit);assert.equal(meta.readOnly,true);assert(meta.schema.some(item=>item.name==='accounts'));passed++;
  const first=await (await call('table',{table:'accounts'})).json();assert.equal(first.rows.length,5);assert.equal(first.nextOffset,5);assert.deepEqual(first.rows[0].secret,{type:'blob',base64:'AP8A'});passed++;
  const second=await (await call('table',{table:'accounts',offset:String(first.nextOffset)})).json();assert.equal(second.rows.length,3);assert.equal(second.nextOffset,null);passed++;
  assert.equal((await (await call('table',{table:'without'})).json()).rows[0].value,'native-owner-unchanged');passed++;
  for(const query of [{table:'accounts; DROP TABLE accounts'}, {table:'accounts',offset:'-1'},{table:'accounts',offset:'1.5'}]) {assert.equal((await call('table',query)).status,400);passed++;}
  const objects=await (await call('objects')).json();assert.equal(objects.objects.length,1);assert.equal(objects.cursor,null);assert.deepEqual(objects.objects[0].customMetadata,{owner:'fixture-only'});assert.equal(objects.objects[0].httpMetadata.contentType,'application/x-fixture');passed++;
  const download=etag=>runtime.dispatchFetch('http://fixture/__migration/export',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operation:'object',key:objects.objects[0].key,etag})});
  const file=await download(objects.objects[0].etag);assert.equal(file.headers.get('Cache-Control'),'private, no-store');assert.deepEqual([...new Uint8Array(await file.arrayBuffer())],[0,1,255]);passed++;
  assert.equal((await download('stale-etag')).status,409);passed++;
  assert.equal((await runtime.dispatchFetch('http://fixture/__migration/export',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'x'.repeat(4097)})).status,400);passed++;
 } finally {await runtime.dispose();}
 for(const extra of [{MIGRATION_EXPORT_EXPIRES_AT:new Date(Date.now()-1000).toISOString()},{MIGRATION_EXPORT_TOKEN_SHA256:''},{MIGRATION_READ_ONLY:'false'}]) {
  const isolated=make(extra);
  try {assert.equal((await isolated.dispatchFetch('http://fixture/__migration/export?operation=schema',{headers:{Authorization:'Bearer '+token}})).status,404);passed++;}
  finally {await isolated.dispose();}
 }
}
console.log(JSON.stringify({migrationExportChecksPassed:passed,liveRequests:false,productionTouched:false}));
