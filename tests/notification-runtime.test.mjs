import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

// Exercise the real Worker scheduled handler and D1 implementation. Every
// provider request is intercepted inside the isolated Worker, not sent online.
let passed=0;
for(const workerPath of ['./build/sites-worker','./build/cloudflare-worker']){
const bundled=await build({stdin:{contents:`import worker from '${workerPath}';import {env} from 'cloudflare:workers';globalThis.fetch=async(input,init)=>{if(String(input)!=='https://api.resend.com/emails')throw Error('Live provider access is forbidden in fixtures');const key=init.headers['Idempotency-Key'];await env.DB.prepare('INSERT OR IGNORE INTO fixture_sends (id,payload) VALUES (?,?)').bind(key,init.body).run();return Response.json({id:'fixture-provider-accepted'});};export default worker;`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers','node:async_hooks'],define:{'import.meta.env.DEV':'false'},plugins:[{name:'scheduled-fixtures',setup(b){
 b.onResolve({filter:/^(vinext\/server\/fetch-handler|@\/app\/auth|@\/lib\/auth\/admin)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='vinext/server/fetch-handler'?'export default {fetch(){return new Response("isolated fixture");}}':args.path==='@/app/auth'?"export function providerAccountId(url,id){return 'supabase:'+new URL(url).hostname+':'+id;}":"export async function getAuthAdmin(){return {projectUrl:'https://fixture-project.supabase.co',client:{auth:{admin:{getUserById:async id=>({data:{user:{id,email:'fixture@example.test',email_confirmed_at:'2026-10-04'}},error:null})}}}};}"}));
}}]});
const runtime=new Miniflare({modules:true,unsafeTriggerHandlers:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SITE_ORIGIN:'https://riparim.example.test',RESEND_API_KEY:'re_fixture_runtime_key',TRANSACTIONAL_EMAIL_FROM:'Riparim <no-reply@auth.example.test>'}});
try{
 const db=await runtime.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort()){
  const statements=(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean);
  for(const statement of statements)await db.prepare(statement).run();
 }
 await db.prepare('CREATE TABLE fixture_sends (id TEXT PRIMARY KEY,payload TEXT NOT NULL)').run();
 await db.prepare("INSERT INTO auth_settings VALUES ('main',?,?,1,1,'2026-10-04')").bind('https://fixture-project.supabase.co','sb_publishable_fixture_key_12345678901234567890').run();
 const id='00000000-0000-4000-8000-000000000010',owner='supabase:fixture-project.supabase.co:00000000-0000-4000-8000-000000000001',event='riparim-review-'+id+'-revision-1';
 await db.prepare('INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,status,revision,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,owner,'fixture-workshop','2026-10-04','Fixture Car','Repair','document','published',1,'2026-10-04').run();
 await db.prepare('INSERT INTO review_notifications (id,visit_id,owner,revision,decision,operation_token,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(event,id,owner,1,'published','fixture-operation',0,'2026-10-04').run();
 const response=await runtime.dispatchFetch('http://127.0.0.1/cdn-cgi/handler/scheduled?cron=*+*+*+*+*');
 assert(response.ok,await response.text());passed++;
 assert.equal((await db.prepare('SELECT state FROM review_notifications WHERE id=?').bind(event).first()).state,'sent');passed++;
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM fixture_sends').first()).n,1);passed++;
 const payload=JSON.parse((await db.prepare('SELECT payload FROM fixture_sends').first()).payload);
 assert.equal(payload.to[0],'fixture@example.test');passed++;
 assert(!payload.text.includes('Fixture Car'));passed++;
 await runtime.dispatchFetch('http://127.0.0.1/cdn-cgi/handler/scheduled?cron=*+*+*+*+*');
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM fixture_sends').first()).n,1);passed++;
}finally{await runtime.dispose();}
}
console.log(JSON.stringify({notificationRuntimeChecksPassed:passed,realEmailsSent:false,productionTouched:false}));
