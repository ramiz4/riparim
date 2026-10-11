import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';

const run=promisify(execFile),directory=await mkdtemp(join(tmpdir(),'riparim-node-http-'));
let server,logs='';
try{
 await run(process.execPath,['scripts/build-node.mjs'],{timeout:180000,maxBuffer:4*1024*1024,env:{...process.env,RIPARIM_DATA_DIR:directory,NEXT_TELEMETRY_DISABLED:'1'}});
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const origin=`http://127.0.0.1:${port}`,environment={...process.env,RIPARIM_DATA_DIR:directory,SITE_ORIGIN:origin,REVIEW_MODERATOR_EMAIL:'moderator@fixture.invalid',NEXT_TELEMETRY_DISABLED:'1'};
 await run(process.execPath,['.node-runtime/command.mjs','migrate'],{env:environment});
 // Keep the real catalogue immutable. This isolated DB has only synthetic rows.
 const db=new DatabaseSync(join(directory,'app.sqlite'));
 const canonical=JSON.parse(await readFile('data/workshops.json','utf8'));
 const marker='workshop-source:'+createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
 db.prepare('INSERT INTO catalog_state VALUES (?,?)').run(marker,'fixture');
 for(const [id,name,status] of [['fixture-public','Synthetic Node Workshop','published'],['fixture-draft','Private Draft Workshop','draft']])db.prepare("INSERT INTO workshops (id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES (?,?, 'Prishtina','Synthetic road 1','+38344123456','[]','[\"Inspektion\"]','Synthetic','Fictional workshop for isolated integration','[]','2026-10-01',?,'2026-10-01T00:00:00Z')").run(id,name,status);
 db.close();
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:environment,stdio:['ignore','pipe','pipe']});
 const closed=new Promise(resolve=>server.on('close',resolve));
 server.stdout.on('data',data=>logs+=data);server.stderr.on('data',data=>logs+=data);
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(server.exitCode!==null)throw new Error(logs);
  try{const response=await fetch(origin+'/api/session');if(response.ok){ready=true;break;}}catch{}
  await delay(100);
 }
 assert(ready,logs);
 const workshops=await (await fetch(origin+'/api/workshops')).json();
 assert.deepEqual(workshops.workshops.map(workshop=>workshop.id),['fixture-public']);
 for(const path of ['/werkstaetten','/en/werkstaetten','/sq/werkstatt/fixture-public']){
  const response=await fetch(origin+path,{redirect:'manual'});assert.equal(response.status,200,path+logs);assert.match(await response.text(),/Synthetic Node Workshop/);
 }
 const draft=await fetch(origin+'/werkstatt/fixture-draft');assert([200,404].includes(draft.status));assert(! (await draft.text()).includes('Private Draft Workshop'),'streamed not-found pages never expose draft data');
 assert.equal((await fetch(origin+'/de/werkstaetten',{redirect:'manual'})).status,308);
 const forged={'oai-authenticated-user-id':'fixture-native','oai-authenticated-user-email':'moderator@fixture.invalid','oai-authenticated-user-full-name':'Fixture Admin'};
 assert.deepEqual(await (await fetch(origin+'/api/session',{headers:forged})).json(),{account:null,isAdmin:false});
 for(const path of ['/api/workshops?admin=1','/api/visits','/api/users','/api/auth-settings','/api/evidence/fixture-private','/api/business/evidence/fixture-private']){
  const response=await fetch(origin+path,{headers:forged});assert.equal(response.status,401,path+logs);
 }
 assert.equal((await fetch(origin+'/api/visits',{method:'POST',headers:forged})).status,401);
 for(const path of ['/.riparim/files.sqlite','/evidence/fixture/private'])assert.equal((await fetch(origin+path)).status,404);
 // The executable retry path awaits all work and does not need a Worker context.
 await run(process.execPath,['.node-runtime/command.mjs','notifications'],{env:environment});
 server.kill('SIGTERM');await closed;server=undefined;
 console.log('Actual Node production server: synthetic public pages/APIs, drafts, forged identity, auth refusal, private storage and outbox command passed');
}catch(error){throw new Error(`${error.stack}\n${error.cause?.stack??''}\n${logs}`);}
finally{
 if(server){const closed=new Promise(resolve=>server.on('close',resolve));server.kill('SIGTERM');await closed;}
 await rm(directory,{recursive:true,force:true});
}
