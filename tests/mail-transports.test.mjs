import {authAdmin as neutralAdmin} from './helpers/auth-contract.mjs';
import {localizeHref} from '../scripts/lib/locale.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

// Only this loopback protocol fixture receives SMTP. No DNS or live email.
let mode='success',started,release;
const partialReplies={'partial-data-451':'451 partial response','partial-data-550':'550 partial response','partial-data-multiline':'451-continue\r\n451 partial response','partial-data-continuation':'451-continue\r\n','partial-data-421':'421 partial connection','closing-greeting-421':'421 closing connection\r\n','rejected-greeting-550':'550 rejected greeting\r\n','partial-greeting-451':'451 partial greeting','partial-greeting-550':'550 partial greeting'};
const sockets=new Set(),messages=[],envelopes=[];let connections=0;
const server=createServer(socket=>{
 connections++;sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
 if(mode==='greeting-timeout')return;
 if(mode.includes('greeting')){socket.end(partialReplies[mode]);return;}
 socket.write('220 fixture.example.test ESMTP\r\n');let buffer='',data=false,current=[];
 socket.on('data',chunk=>{
  buffer+=chunk.toString();let newline;
  while((newline=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+2);
   if(data){
    if(line!=='.'){current.push(line.replace(/^\.\./,'.'));continue;}
    data=false;messages.push(current.join('\r\n')+'\r\n');current=[];
    const row=event();assert.equal(row.state,'sending');assert.equal(row.smtp_in_flight,1,'The SMTP start marker is durable before DATA');assert(row.payload&&row.wire_payload&&row.transport==='smtp');
    if(mode==='data-rejected'){socket.write('554 content rejected\r\n');continue;}
    if(partialReplies[mode]){socket.end(partialReplies[mode]);continue;}
    if(mode==='disconnect'){socket.destroy();continue;}
    if(mode==='pause'){started?.();new Promise(resolve=>release=resolve).then(()=>socket.write('250 accepted\r\n'));continue;}
    socket.write('250 accepted\r\n');continue;
   }
   if(/^EHLO|^HELO/.test(line))socket.write('250-fixture.example.test\r\n250 PIPELINING\r\n');
   else if(/^MAIL FROM:/.test(line)){envelopes.push({from:line,to:''});socket.write('250 sender\r\n');}
   else if(/^RCPT TO:/.test(line)){envelopes.at(-1).to=line;socket.write(mode==='temporary'?'451 temporary rejection\r\n':mode==='rejected'?'550 recipient rejected\r\n':'250 recipient\r\n');}
   else if(line==='DATA'){socket.write('354 data\r\n');data=true;}
   else if(line==='QUIT'){socket.end('221 bye\r\n');}
   else socket.write('250 ok\r\n');
  }
 });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const out='.test-runtime/mail-transports';await mkdir(out,{recursive:true});
const bundle=await build({entryPoints:{outbox:'lib/notifications/outbox.ts'},outdir:out,bundle:true,write:false,format:'esm',platform:'node',packages:'external',alias:{'@/lib/notifications/smtp':new URL('../lib/notifications/node-smtp.ts',import.meta.url).pathname},plugins:[{name:'isolated-runtime',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|@\/lib\/auth\/admin)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='cloudflare:workers'?'export const env=globalThis.fixtureEnv;':'export async function getAuthAdmin(){return globalThis.fixtureAuthAdmin;}'}));
}}]});
for(const file of bundle.outputFiles)await writeFile(file.path.replace(/\.js$/,'.mjs'),file.contents);
const db=new DatabaseSync(':memory:');for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
let failFreeze=false,failSuccess=false,failAfterSuccess=false;
const d1={prepare(sql){const statement=db.prepare(sql);const adapter=(values=[])=>({bind:(...next)=>adapter(next),first:async()=>statement.get(...values)??null,all:async()=>({results:statement.all(...values)}),run:async()=>{
 if(failSuccess&&sql.includes("state='sent'")){failSuccess=false;throw Error('lost success write');}
 const result=statement.run(...values);
 if(failFreeze&&sql.includes('first_attempt_at=COALESCE')){failFreeze=false;throw Error('lost persistent start acknowledgement');}
 if(failAfterSuccess&&sql.includes("state='sent'")){failAfterSuccess=false;throw Error('lost committed success acknowledgement');}
 return {meta:result};}});return adapter();}};
const projectUrl='https://fixture-project.supabase.co',subject='00000000-0000-4000-8000-000000000001',owner=`supabase:fixture-project.supabase.co:${subject}`;
let locale='de',contact='member@example.test',currentEvent;
globalThis.fixtureAuthAdmin={projectUrl,provider:"supabase",client:neutralAdmin({getUserById:async id=>({data:{user:{id,email:contact,email_confirmed_at:'2026-10-04',user_metadata:{preferred_locale:locale}}},error:null})},projectUrl)};
const smtpUrl=`smtp://127.0.0.1:${server.address().port}`;
globalThis.fixtureEnv={DB:d1,BUCKET:{},SITE_ORIGIN:'https://riparim.example.test',EMAIL_TRANSPORT:'smtp',SMTP_URL:smtpUrl,TRANSACTIONAL_EMAIL_FROM:'Riparim <no-reply@auth.example.test>',RESEND_API_KEY:'re_fixture_secret'};
db.prepare("INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,1,'2026-10-04')").run(projectUrl,'sb_publishable_fixture_key_12345678901234567890');
const outbox=await import(new URL(`../${out}/outbox.mjs`,import.meta.url));
const event=()=>db.prepare('SELECT * FROM review_notifications WHERE id=?').get(currentEvent);
function enqueue(){
 const id=crypto.randomUUID();currentEvent='riparim-review-'+id+'-revision-1';
 db.prepare('INSERT INTO visits(id,owner,workshop,date,vehicle,service,evidence_type,status,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,owner,'fixture-workshop','2026-10-04','PRIVATE vehicle','Repair','document','published',1,'2026-10-04');
 db.prepare('INSERT INTO review_notifications(id,visit_id,owner,revision,decision,operation_token,next_attempt_at,created_at) VALUES(?,?,?,?,?,?,?,?)').run(currentEvent,id,owner,1,'published','fixture-operation',0,'2026-10-04');return currentEvent;
}
const run=(force=false)=>outbox.processNotifications({id:currentEvent,force});
const nativeFetch=globalThis.fetch;let resendRequests=0;const resendBodies=[];
globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://api.resend.com/emails');assert.equal(options.redirect,'error');resendBodies.push(options.body);resendRequests++;return Response.json({id:'fixture-resend-id'});};
let passed=0;const check=(value,label)=>{assert(value,label);passed++;};
try{
 for(const language of ['de','sq','en']){
  locale=language;enqueue();await run();check(event().state==='sent'&&messages.length>0,'Node SMTP executes a real isolated protocol delivery');
  const mime=messages.at(-1).replace(/=\r\n/g,'').replace(/=([0-9A-F]{2})/g,(_match,hex)=>String.fromCharCode(parseInt(hex,16)));
  const link=new URL(mime.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'));
  check(mime.includes('lang="'+language+'"')&&link.pathname===localizeHref('/anmelden',language)&&link.searchParams.get('weiter').startsWith(localizeHref('/bewertungen?einreichung=',language)),'The frozen message retains the confirmed recipient locale and owned link');
  check(!mime.includes('PRIVATE')&&envelopes.at(-1).from==='MAIL FROM:<no-reply@auth.example.test>'&&envelopes.at(-1).to==='RCPT TO:<member@example.test>','SMTP receives only server-verified generic content and envelope');
  check(event().payload===null&&event().wire_payload===null&&event().smtp_in_flight===0,'Acceptance clears both private frozen forms');
 }
 check(resendRequests===0,'SMTP never silently invokes Resend');locale='sq';
 enqueue();mode='temporary';await run();check(event().state==='pending'&&event().smtp_in_flight===0&&event().next_attempt_at>Date.now(),'A complete SMTP 451 rejection permits durable backoff without acceptance ambiguity');
 const frozenBody=event().payload,frozenWire=event().wire_payload;
 locale='en';globalThis.fixtureEnv.TRANSACTIONAL_EMAIL_FROM='Changed <changed@auth.example.test>';mode='success';await run(true);
 check(event().state==='sent'&&messages.at(-1)===Buffer.from(frozenWire,'base64').toString(),'Known-rejection retries use byte-identical MIME after sender and locale changes');
 check(JSON.parse(frozenBody).from==='Riparim <no-reply@auth.example.test>'&&envelopes.at(-1).from==='MAIL FROM:<no-reply@auth.example.test>','The original sender bytes and envelope remain pinned');globalThis.fixtureEnv.TRANSACTIONAL_EMAIL_FROM='Riparim <no-reply@auth.example.test>';
 enqueue();mode='rejected';await run();check(event().state==='blocked'&&event().last_error==='provider_rejected'&&event().smtp_in_flight===0,'SMTP 550 is an explicit non-acceptance visible for repair');mode='success';await run(true);check(event().state==='sent','Only known non-acceptance can be explicitly retried');
 enqueue();mode='data-rejected';await run();check(event().state==='blocked'&&event().smtp_in_flight===0&&event().last_error==='provider_rejected','An explicit negative final DATA response proves non-acceptance after bytes');mode='success';await run(true);check(event().state==='sent','A final DATA rejection permits an explicit repair retry of frozen bytes');
 for(const responseMode of Object.keys(partialReplies)){
  enqueue();mode=responseMode;const beforePartial=connections,beforeBytes=messages.length;await run();const first=event();
  mode='success';await run(true);
  check(first.state==='unknown'&&first.smtp_in_flight===1&&!outbox.canRetryNotification(first),'Partial and connection responses remain uncertain despite an SMTP-looking status: '+responseMode);
  check(event().state==='unknown'&&connections===beforePartial+1&&messages.length===beforeBytes+(responseMode.includes('greeting')?0:1),'Force never resends after a partial reply or connection failure: '+responseMode);
 }
 enqueue();mode='disconnect';const beforeDisconnect=messages.length;await run();check(event().state==='unknown'&&event().last_error==='delivery_uncertain'&&messages.length===beforeDisconnect+1,'Acceptance followed by socket loss is never automatically retried');
 const uncertain=event();mode='success';await run(true);check(event().state==='unknown'&&messages.length===beforeDisconnect+1&&!outbox.canRetryNotification(event()),'Force cannot resend an uncertain SMTP event');
 enqueue();failSuccess=true;const beforeSuccessLoss=messages.length;await run();check(event().state==='unknown'&&messages.length===beforeSuccessLoss+1,'A lost successful DB write after SMTP acceptance stays unknown');await run(true);check(messages.length===beforeSuccessLoss+1,'A lost successful write cannot be repaired by sending twice');
 enqueue();failAfterSuccess=true;const beforeAckLoss=messages.length;await run();check(event().state==='sent'&&messages.length===beforeAckLoss+1,'A lost acknowledgement of a committed success preserves sent');await run(true);check(messages.length===beforeAckLoss+1,'A committed-success acknowledgement loss never resends');
 enqueue();failFreeze=true;const beforeFreeze=connections;await run();check(event().state==='unknown'&&connections===beforeFreeze&&event().smtp_in_flight===1,'Lost acknowledgement of the durable start marker prevents network execution and requires reconciliation');await run(true);check(connections===beforeFreeze,'Force cannot bypass an ambiguous start commit');
 enqueue();db.prepare("UPDATE review_notifications SET state='sending',lease_until=0,lease_token='dead-process',transport='smtp',smtp_in_flight=1,first_attempt_at=?,payload=?,wire_payload=? WHERE id=?").run(Date.now(),uncertain.payload,uncertain.wire_payload,currentEvent);
 const beforeCrash=connections;check(!outbox.canRetryNotification(event()),'The public retry contract rejects an expired in-flight SMTP lease');await run(true);check(event().state==='unknown'&&connections===beforeCrash,'A restarted process quarantines an expired SMTP lease before claiming');
 enqueue();mode='pause';const waiting=new Promise(resolve=>started=resolve),job=run();await waiting;const beforeConcurrency=connections;await run(true);check(connections===beforeConcurrency,'A fresh lease prevents parallel SMTP processing');
 db.prepare('UPDATE review_notifications SET lease_until=0 WHERE id=?').run(currentEvent);await Promise.all([run(),run(true)]);check(event().state==='unknown'&&connections===beforeConcurrency,'Expired concurrent processing quarantines begun SMTP without a second connection');release();await job;check(event().state==='unknown','The late first process cannot overwrite reconciled lease loss');mode='success';started=null;
 enqueue();mode='temporary';await run();const beforeSwitch=connections;globalThis.fixtureEnv.EMAIL_TRANSPORT='resend';await run(true);check(event().state==='blocked'&&event().last_error==='credential_changed'&&resendRequests===0,'A begun SMTP event cannot move to another provider');globalThis.fixtureEnv.EMAIL_TRANSPORT='smtp';
 for(const url of [smtpUrl.replace('127.0.0.1','localhost'),smtpUrl.replace('smtp:','smtps:'),smtpUrl.replace('127.0.0.1','user:password@127.0.0.1'),smtpUrl.replace(String(server.address().port),String(server.address().port+1))]){
  globalThis.fixtureEnv.SMTP_URL=url;globalThis.fixtureEnv.SMTP_SECRET_ORIGIN=url.replace('user:password@','');await run(true);check(event().last_error==='credential_changed'&&connections===beforeSwitch,'Host, TLS, user/password and port changes cannot mutate a begun delivery scope');
 }globalThis.fixtureEnv.SMTP_URL=smtpUrl;delete globalThis.fixtureEnv.SMTP_SECRET_ORIGIN;
 contact='changed@example.test';await run(true);check(event().last_error==='recipient_changed'&&connections===beforeSwitch,'Changed confirmed contact cannot alter the frozen envelope');contact='member@example.test';mode='success';await run(true);check(event().state==='sent','Restoring exact scope after known rejection permits its original delivery');
 enqueue();const historical=' {"html":"historical HTML", "subject":"Historical", "to":["member@example.test"], "from":"old@auth.example.test"}\n';const keyHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(globalThis.fixtureEnv.RESEND_API_KEY))).toString('hex');
 db.prepare('UPDATE review_notifications SET first_attempt_at=?,payload=?,provider_key_hash=? WHERE id=?').run(Date.now(),historical,keyHash,currentEvent);const beforeLegacy=connections;await run(true);check(event().state==='blocked'&&event().last_error==='credential_changed'&&connections===beforeLegacy,'Historical NULL transport means Resend and never becomes SMTP');globalThis.fixtureEnv.EMAIL_TRANSPORT='resend';await run(true);check(event().state==='sent'&&resendRequests===1&&resendBodies.at(-1)===historical,'A historical Resend request remains executable under its original scope');globalThis.fixtureEnv.EMAIL_TRANSPORT='smtp';
 enqueue();for(const url of [smtpUrl+'?tls.rejectUnauthorized=false',smtpUrl+'/path',smtpUrl+'#fragment',smtpUrl.replace('127.0.0.1','user:password@127.0.0.1')]){
  globalThis.fixtureEnv.SMTP_URL=url;const beforeInvalid=connections;await run(true);check(event().state==='blocked'&&event().last_error==='configuration_missing'&&connections===beforeInvalid,'URL overrides, paths and unbound credentials are rejected before network start');
 }globalThis.fixtureEnv.SMTP_URL=smtpUrl;
 enqueue();mode='success';globalThis.fixtureEnv.SMTP_URL=smtpUrl.replace('127.0.0.1','localhost');const beforePlaintext=messages.length;await run();check(event().state==='unknown'&&messages.length===beforePlaintext,'Off-loopback SMTP refuses a peer without mandatory STARTTLS');globalThis.fixtureEnv.SMTP_URL=smtpUrl;
 enqueue();mode='greeting-timeout';const clock=performance.now();await run();check(event().state==='unknown'&&performance.now()-clock<11000,'A silent SMTP greeting is bounded well below the 120-second lease');mode='success';
 const queue=await outbox.notificationQueue();check(!JSON.stringify(queue).includes('member@example.test')&&!JSON.stringify(queue).includes(frozenWire)&&!JSON.stringify(queue).includes('re_fixture_secret'),'The protected queue reveals no address, payload, MIME or credentials');
 console.log(JSON.stringify({smtpTransportChecksPassed:passed,realEmailsSent:false}));
}finally{
 globalThis.fetch=nativeFetch;for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));db.close();
}
