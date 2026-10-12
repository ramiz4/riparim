import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {createHash} from 'node:crypto';

// Every outbound request is answered by isolated fixtures. Inspector samples
// measure active execution comparatively; they are not Cloudflare billed CPU.
const sampleCount=Number(process.env.CPU_PROFILE_SAMPLES??30),coldCount=Number(process.env.CPU_PROFILE_COLD??3);
const populated=process.env.CPU_PROFILE_POPULATED==='1';
if(!Number.isSafeInteger(sampleCount)||sampleCount<1||sampleCount>100||!Number.isSafeInteger(coldCount)||coldCount<1||coldCount>10)throw Error('Use 1–100 warm samples and 1–10 cold isolates');
const output=resolve(process.env.CPU_PROFILE_OUTPUT??'work/cpu-profiles');await mkdir(output,{recursive:true});
const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
if(config.name!=='riparim')throw Error('Build the Cloudflare target before profiling');
const catalogue=JSON.parse(await readFile('dist/catalogue-import.json','utf8'));
const modules=(await readdir('dist/server',{recursive:true})).filter(file=>file.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b)).map(file=>({type:'ESModule',path:resolve('dist/server',file)}));
const artifactHash=createHash('sha256');for(const runtimeModule of modules){artifactHash.update(runtimeModule.path.slice(resolve('dist/server').length));artifactHash.update(await readFile(runtimeModule.path));}const workerArtifactSha256=artifactHash.digest('hex');
const migrations=[];for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())migrations.push(...(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').filter(sql=>sql.trim()));
const origin='https://fixture-project.supabase.co',subject='00000000-0000-4000-8000-000000000001',sessionId='00000000-0000-4000-8000-000000000002';
const user={id:subject,email:'member@example.test',email_confirmed_at:'2026-10-11',app_metadata:{provider:'email'},user_metadata:{full_name:'Fixture Member'},identities:[]};
const expiresAt=Math.floor(Date.now()/1000)+3600;
const token=[{alg:'HS256',typ:'JWT'},{sub:subject,aud:'authenticated',iss:origin+'/auth/v1',session_id:sessionId,amr:[{method:'password'}],exp:expiresAt},'fixture-signature'].map(value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'fixture-refresh',expires_at:expiresAt,expires_in:3600,token_type:'bearer',user};
const cookie=expired=>'sb-fixture-project-auth-token=base64-'+Buffer.from(JSON.stringify({...session,...(expired?{expires_at:1}:{})})).toString('base64url');
const paths=[['/api/session','json'],['/api/business','json'],['/api/visits','json'],['/api/account','json'],['/api/auth-options','json'],['/anmelden','html'],['/bewertungen','html'],['/einstellungen','html'],['/betrieb','html'],['/verwaltung','html'],['/werkstaetten?_rsc','rsc'],['/en/workshops?_rsc','rsc'],['/sq/serviset?_rsc','rsc'],['/bewertungen?_rsc','rsc'],['/betrieb?_rsc','rsc'],['/einstellungen?_rsc','rsc'],['/','html'],['/api/workshops?locale=en','json']];
const cases=paths.flatMap(([path,format])=>['guest','authenticated'].map(state=>({path,format,state})));cases.push({path:'/api/session',format:'json',state:'unrelated'},{path:'/api/session',format:'json',state:'unmapped'},{path:'/api/session',format:'json',state:'expired'},{path:'/api/session',format:'json',state:'outage'});
const selected=process.env.CPU_PROFILE_CASES?cases.filter(value=>process.env.CPU_PROFILE_CASES.split(',').includes(value.path)):cases;
if(!selected.length)throw Error('No profile cases selected');

async function openInspector(runtime){
 const base=await runtime.getInspectorURL();base.protocol='http:';
 const targets=await(await fetch(new URL('/json',base))).json(),target=targets.find(value=>value.id==='core:user:');
 if(!target)throw Error('Worker Inspector target unavailable');
 const socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});setTimeout(()=>reject(Error('Inspector connection timed out')),5000).unref();});
 let nextId=0;const pending=new Map();
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data),waiting=pending.get(message.id);if(!waiting)return;pending.delete(message.id);if(message.error)waiting.reject(Error(JSON.stringify(message.error)));else waiting.resolve(message.result);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:100});
 return {send,close:()=>socket.close()};
}
async function createRuntime(state){
 let providerCalls=0;
 const runtime=new Miniflare({modules,modulesRoot:resolve('dist/server'),compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,inspectorPort:0,d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SITE_ORIGIN:'https://riparim.com'},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,static_routing:{user_worker:config.assets.run_worker_first}},assetConfig:{html_handling:config.assets.html_handling}},outboundService:request=>{
  const url=new URL(request.url);if(url.origin!==origin)throw Error('Profiler forbids live provider access');providerCalls++;
  if(state==='outage')return new Response('Isolated provider outage',{status:503});
  if(url.pathname==='/auth/v1/user')return Response.json(user);
  if(url.pathname==='/auth/v1/settings')return Response.json({external:{email:true,google:true},mailer_autoconfirm:false,disable_signup:false});
  if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='refresh_token')return Response.json(session);
  return new Response('Unsupported provider fixture',{status:502});
 }});
 try{
  const db=await runtime.getD1Database('DB');
  for(const sql of migrations)await db.prepare(sql).run();
  for(let offset=0;offset<catalogue.statements.length;offset+=50)await db.batch(catalogue.statements.slice(offset,offset+50).map(({sql,params})=>db.prepare(sql).bind(...params)));
  await db.prepare(catalogue.completionSql).bind(catalogue.key,'fixture').run();
  await db.prepare("INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,1,'fixture')").bind(origin,'sb_publishable_fixture_public_key_1234567890').run();
  await db.prepare("INSERT INTO auth_sessions (id,account_id,revoked,legacy_access,expires_at,created_at) VALUES (?,?,0,0,?,'fixture')").bind(sessionId,'supabase:fixture-project.supabase.co:'+subject,Date.now()+3600000).run();
  if(state!=='unmapped')await db.prepare("INSERT INTO auth_identities(provider,issuer,subject,account_id,created_at) VALUES ('supabase',?,?,?,'fixture')").bind(origin,subject,'supabase:fixture-project.supabase.co:'+subject).run();
  if(populated){
   const account='supabase:fixture-project.supabase.co:'+subject,workshop=await db.prepare("SELECT id,phone,phone_note,whatsapp,services,service_details,description,updated_at FROM workshops WHERE status='published' ORDER BY id LIMIT 1").first();
   await db.prepare("INSERT INTO auth_links(account_id,legacy_owner,owner_admin,created_at,password_access) VALUES (?,'fixture-legacy',0,'fixture',1)").bind(account).run();
   await db.prepare("UPDATE auth_sessions SET legacy_access=1").run();
   for(const [index,owner] of [account,'fixture-legacy','fixture-foreign'].entries())await db.prepare("INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,evidence_note,display_name,rating,review,status,created_at) VALUES (?,?,?,'2026-10-11','Fixture vehicle','Repair','Anderer Nachweis',?,'Fixture Member',5,?,'pending','2026-10-11')").bind('00000000-0000-4000-8000-'+String(index+10).padStart(12,'0'),owner,workshop.id,'Isolated private visit evidence '.repeat(20),'Isolated review '.repeat(20)).run();
   const claim='00000000-0000-4000-8000-000000000020';
   await db.prepare("INSERT INTO workshop_claims(id,owner,workshop_id,evidence,created_at) VALUES (?,?,?,?, '2026-10-11')").bind(claim,account,workshop.id,'Isolated ownership evidence '.repeat(20)).run();
   await db.prepare("INSERT INTO workshop_owners(workshop_id,account_id,claim_id,confirmed_at,confirmed_by) VALUES (?,?,?,'2026-10-11','fixture-admin')").bind(workshop.id,account,claim).run();
   const profile={phone:workshop.phone,phoneNote:workshop.phone_note,whatsapp:workshop.whatsapp,services:JSON.parse(workshop.services),serviceDetails:JSON.parse(workshop.service_details),description:workshop.description};
   await db.prepare("INSERT INTO workshop_changes(id,owner,workshop_id,profile,base_updated_at,created_at) VALUES ('00000000-0000-4000-8000-000000000021',?,?,?,?, '2026-10-11')").bind(account,workshop.id,JSON.stringify(profile),workshop.updated_at).run();
  }
  return {runtime,inspector:await openInspector(runtime),providerCalls:()=>providerCalls};
 }catch(error){await runtime.dispose();throw error;}
}
async function measure(fixture,test){
 const headers={...(test.state==='guest'?{}:test.state==='unrelated'?{cookie:'preferences=sq; cf_clearance=fixture-browser-preference'}:{cookie:cookie(['expired','outage'].includes(test.state))}),...(test.format==='rsc'?{RSC:'1',Accept:'text/x-component'}:{})};
 const before=fixture.providerCalls();await fixture.inspector.send('Profiler.start');const started=performance.now();
 const response=await fixture.runtime.dispatchFetch('https://riparim.com'+test.path,{headers,redirect:'manual'}),body=await response.text(),wallMs=performance.now()-started;
 const {profile}=await fixture.inspector.send('Profiler.stop'),nodes=new Map(profile.nodes.map(node=>[node.id,node.callFrame])),totals=new Map();
 for(let index=0;index<(profile.samples?.length??0);index++){const frame=nodes.get(profile.samples[index]);if(!frame||['(idle)','(program)'].includes(frame.functionName))continue;const key=frame.functionName+' '+frame.url;totals.set(key,(totals.get(key)??0)+profile.timeDeltas[index]);}
 const protectedApi=['/api/business','/api/visits'].includes(test.path),expectedStatus=protectedApi&&test.state==='guest'?401:200;
 if(response.status!==expectedStatus)throw Error(test.path+' unexpectedly returned '+response.status+' instead of '+expectedStatus);
 if(test.path==='/api/session'){const value=JSON.parse(body),signedIn=['authenticated','expired','unmapped'].includes(test.state);if(!!value.account!==signedIn||value.isAdmin!==false)throw Error('Invalid isolated profile session outcome');}
 return {profile,result:{sampledCpuMs:[...totals.values()].reduce((a,b)=>a+b,0)/1000,wallMs,status:response.status,bytes:Buffer.byteLength(body),providerCalls:fixture.providerCalls()-before,top:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,7)}};
}
function stats(results){const values=results.map(value=>value.sampledCpuMs).sort((a,b)=>a-b);return {n:values.length,median:values.length%2?values[Math.floor(values.length/2)]:(values[values.length/2-1]+values[values.length/2])/2,p95:values[Math.ceil(values.length*.95)-1],maximum:values.at(-1)};}
const summaries=[];
console.log(JSON.stringify({commit:catalogue.commit,workerArtifactSha256,populated,buildTarget:config.name,cpuKind:'Inspector active sampling, not billed CPU',coldDefinition:'First HTTP request per fresh workerd isolate; module startup before Inspector sampling is excluded',warmDefinition:'Repeated requests in the first case isolate after its cold request',coldIsolates:coldCount,warmRequests:sampleCount,liveRequests:false}));
for(const test of selected){
 const key=test.state+'-'+test.format+'-'+test.path.replace(/[^a-zA-Z0-9-]/g,'_'),cold=[],warm=[];let warmFixture;
 try{
  for(let index=0;index<coldCount;index++){
   const fixture=await createRuntime(test.state);
   try{const sample=await measure(fixture,test);cold.push(sample.result);if(index===0){warmFixture=fixture;await writeFile(resolve(output,key+'-cold.cpuprofile'),JSON.stringify(sample.profile));}}
   finally{if(index!==0){fixture.inspector.close();await fixture.runtime.dispose();}}
  }
  for(let index=0;index<sampleCount;index++){const sample=await measure(warmFixture,test);warm.push(sample.result);if(index===sampleCount-1)await writeFile(resolve(output,key+'-warm.cpuprofile'),JSON.stringify(sample.profile));}
 }finally{if(warmFixture){warmFixture.inspector.close();await warmFixture.runtime.dispose();}}
 const summary={...test,cold:stats(cold),warm:stats(warm),samples:{cold,warm}};summaries.push(summary);console.log(JSON.stringify({...test,cold:summary.cold,warm:summary.warm,bytes:warm[0].bytes,providerCalls:warm[0].providerCalls}));
}
await writeFile(resolve(output,'summary.json'),JSON.stringify({commit:catalogue.commit,workerArtifactSha256,populated,cpuKind:'Inspector active sampling, not billed CPU',coldCount,sampleCount,results:summaries},null,2)+'\n');
