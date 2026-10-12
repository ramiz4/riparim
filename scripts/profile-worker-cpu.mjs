import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
// Local workerd only, synthetic catalogue and blocked provider access.
// Sampling is comparative evidence, not a Cloudflare billing measurement.
await mkdir('work/cpu-profiles',{recursive:true});
const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
if(config.name!=='riparim')throw Error('Build the Cloudflare target before profiling');
const modules=(await readdir('dist/server',{recursive:true})).filter(f=>f.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b)).map(f=>({type:'ESModule',path:resolve('dist/server',f)}));
const mf=new Miniflare({modules,modulesRoot:resolve('dist/server'),compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,inspectorPort:0,d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SITE_ORIGIN:'https://riparim.com'},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,static_routing:{user_worker:config.assets.run_worker_first}},assetConfig:{html_handling:config.assets.html_handling}},outboundService:()=>new Response('No network',{status:502})});
try{
const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const s of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(s).run();
await (await mf.dispatchFetch('https://riparim.com/api/workshops')).text();
const base=await mf.getInspectorURL();base.protocol='http:';const targets=await(await fetch(new URL('/json',base))).json();const ws=new WebSocket(targets.find(t=>t.id==='core:user:')?.webSocketDebuggerUrl??targets[0].webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});setTimeout(()=>j(Error('Inspector connection timed out')),5000).unref();});let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const cb=pending.get(m.id);pending.delete(m.id);if(m.error)cb.reject(Error(JSON.stringify(m.error)));else cb.resolve(m.result);}});const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:100});
for(const path of ['/','/werkstaetten','/api/session','/api/workshops','/anmelden','/datenschutz','/wp-admin/install.php']){
 await (await mf.dispatchFetch('https://riparim.com'+path)).text();await send('Profiler.start');
 let snapshot;const start=performance.now();for(let i=0;i<10;i++){const res=await mf.dispatchFetch('https://riparim.com'+path);snapshot=res.headers.get('X-Riparim-Public-Snapshot');await res.text();}
 const {profile}=await send('Profiler.stop');await writeFile('work/cpu-profiles/'+(path.replaceAll('/','_')||'home')+'.cpuprofile',JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame])),totals=new Map();for(let i=0;i<profile.samples.length;i++){const f=nodes.get(profile.samples[i]);if(['(idle)','(program)'].includes(f.functionName))continue;const key=f.functionName+' '+f.url;totals.set(key,(totals.get(key)??0)+profile.timeDeltas[i]);}
 console.log(JSON.stringify({path,snapshot,wallMs:(performance.now()-start)/10,sampledCpuMs:[...totals.values()].reduce((a,b)=>a+b,0)/10000,top:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,7)}));
}
ws.close();
}finally{await mf.dispose();}
