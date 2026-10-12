import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer as httpsServer,request as httpsRequest} from 'node:https';
import {createServer as smtpServer} from 'node:net';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash,createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {backupFixture} from './provider-exit-backup.mjs';
import {restoreNodeBackup} from '../../scripts/restore-node.mjs';
import {exportSource} from '../../scripts/export-source.mjs';

const ids={member:'00000000-0000-4000-8000-000000000001',foreign:'00000000-0000-4000-8000-000000000002',admin:'00000000-0000-4000-8000-000000000003',blocked:'00000000-0000-4000-8000-000000000004',deleted:'00000000-0000-4000-8000-000000000005'};
const reviewId='10000000-0000-4000-8000-000000000001',foreignReview='10000000-0000-4000-8000-000000000002',pinnedReview='10000000-0000-4000-8000-000000000003';
const key='sb_publishable_synthetic_provider_exit_1234567890',secret='sb_secret_synthetic_provider_exit',encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const stable=name=>'opaque-stable-'+name;
export async function providerExitHttp({directory,port,start,stop}){
 const parent=join(directory,'provider-exit');await mkdir(parent,{mode:0o700});
 const tls={key:await readFile('tests/fixtures/smtp/key.pem'),cert:await readFile('tests/fixtures/smtp/cert.pem')},members=new Map(),tokens=new Map(),requests=[];
 for(const [name,id] of Object.entries(ids))members.set(id,{id,email:'fixture-'+name+'@example.test',email_confirmed_at:'2026-10-11T00:00:00Z',aud:'authenticated',role:'authenticated',created_at:'2026-10-11T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:'Synthetic '+name,preferred_locale:'en',role:'admin',is_admin:true},identities:[]});
 let sequence=0;const sockets=new Set(),messages=[];
 const handlerFor=providerMembers=>async(request,response)=>{
  const members=providerMembers;
  const url=new URL(request.url,'https://'+request.headers.host),chunks=[];for await(const chunk of request)chunks.push(chunk);const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
  requests.push({path:url.pathname,method:request.method});
  const json=(value,status=200)=>{response.writeHead(status,{'content-type':'application/json','x-supabase-api-version':'2024-01-01'});response.end(JSON.stringify(value));};
  if(url.pathname.startsWith('/auth/v1/admin/')){
   if(request.headers.apikey!==secret||request.headers.authorization!=='Bearer '+secret)return json({error_code:'bad_jwt'},401);
   const id=url.pathname.split('/').at(-1),user=members.get(id);if(!user)return json({error_code:'user_not_found'},404);
   if(request.method==='DELETE'){members.delete(id);return json(user);}return json(user);
  }
  if(request.headers.apikey!==key)return json({error_code:'bad_jwt'},401);
  if(url.pathname==='/auth/v1/settings')return json({external:{email:true,google:false},mailer_autoconfirm:false});
  if(url.pathname==='/auth/v1/token'){
   const user=[...members.values()].find(item=>item.email===body.email);if(!user||body.password!=='synthetic-password-123')return json({error_code:'invalid_credentials'},400);
   const payload=encode({sub:user.id,iss:url.origin+'/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),session_id:'exit-session-'+(++sequence),amr:[{method:'password'}]});const header=encode({alg:'HS256',typ:'JWT'}),signature=createHmac('sha256','synthetic-fixture-signing-key').update(header+'.'+payload).digest('base64url'),token=header+'.'+payload+'.'+signature;
   tokens.set(token,user.id);return json({access_token:token,refresh_token:'synthetic-refresh-'+sequence,token_type:'bearer',expires_in:3600,user});
  }
  const token=request.headers.authorization?.replace(/^Bearer /,''),user=members.get(tokens.get(token));
  if(url.pathname==='/auth/v1/user')return user?json(user):json({error_code:'bad_jwt'},401);
  if(url.pathname==='/auth/v1/logout'){tokens.delete(token);response.writeHead(204);return response.end();}
  return json({error_code:'fixture_endpoint_missing'},404);
 };
 const sourceMembers=new Map([...members].map(([id,user])=>[id,structuredClone(user)])),sourceAuth=httpsServer(tls,handlerFor(sourceMembers)),targetAuth=httpsServer(tls,handlerFor(members));
 for(const server of [sourceAuth,targetAuth]){server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));}
 const sourceOrigin='https://127.0.0.1:'+sourceAuth.address().port,targetOrigin='https://127.0.0.1:'+targetAuth.address().port;
 const mail=smtpServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});socket.write('220 isolated-exit ESMTP\r\n');let buffer='',data=false,lines=[];
  socket.on('data',chunk=>{buffer+=chunk;let index;while((index=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+2);
   if(data){if(line==='.'){data=false;messages.push(lines.join('\r\n'));lines=[];socket.write('250 accepted by isolated fixture\r\n');}else lines.push(line);continue;}
   if(/^EHLO/.test(line))socket.write('250 isolated-exit\r\n');else if(line==='DATA'){socket.write('354 continue\r\n');data=true;}else if(line==='QUIT')socket.end('221 bye\r\n');else socket.write('250 okay\r\n');
  }});
 });await new Promise(resolve=>mail.listen(0,'127.0.0.1',resolve));
 const verify=identity=>new Promise((resolve,reject)=>{const request=httpsRequest(new URL('/auth/v1/admin/users/'+identity.subject,identity.issuer),{ca:tls.cert,headers:{apikey:secret,Authorization:'Bearer '+secret}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{try{const user=JSON.parse(Buffer.concat(chunks));resolve(response.statusCode===200&&user.id===identity.subject&&[sourceOrigin,targetOrigin].includes(identity.issuer));}catch(error){reject(error);}});});request.on('error',reject);request.end();});
 const origin='http://127.0.0.1:'+port,publicOrigin='https://node-exit.fixture.invalid',caPath=new URL('../fixtures/smtp/cert.pem',import.meta.url).pathname;
 try{
  const backup=await backupFixture(parent,async storage=>{
   globalThis.providerExitEnv={DB:storage.db,BUCKET:storage.bucket};
   const sourceData=JSON.parse(await readFile('data/workshops.json','utf8')),marker='workshop-source:'+createHash('sha256').update(JSON.stringify(sourceData)).digest('hex');await storage.db.prepare('INSERT INTO catalog_state VALUES (?,?)').bind(marker,'fixture').run();
   for(const [id,name,status] of [['exit-public','Synthetic Exit Workshop','published'],['exit-hidden','Synthetic Hidden Workshop','draft']])await storage.db.prepare("INSERT INTO workshops (id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES (?,?,'Prishtina','Synthetic road','+38344123456','[]','[\"Inspektion & Wartung\"]','Fixture','Synthetic isolated workshop','[]','2026-10-11',?,'2026-10-11')").bind(id,name,status).run();
   await storage.db.prepare("INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,1,'2026-10-11')").bind(sourceOrigin,key).run();
   for(const [name,subject] of Object.entries(ids))await storage.db.prepare('INSERT INTO auth_identities VALUES (?,?,?,?,?)').bind('supabase',sourceOrigin,subject,stable(name),'2026-10-11').run();
   await storage.db.prepare("INSERT INTO auth_account_roles VALUES (?,'admin','2026-10-11','synthetic-bootstrap')").bind(stable('admin')).run();
   for(const [name,status] of [['blocked','inactive'],['deleted','deleted']])await storage.db.prepare('INSERT INTO auth_account_status VALUES (?,?,?)').bind(stable(name),status,'2026-10-11').run();
   const bytes='%PDF-1.7 synthetic original private evidence';
   for(const [id,name,status] of [[reviewId,'member','pending'],[foreignReview,'foreign','published'],[pinnedReview,'foreign','published']]){
    const object=await storage.bucket.put('evidence/'+stable(name)+'/'+id+'/original.pdf',bytes,{httpMetadata:{contentType:'application/pdf'},customMetadata:{source:'synthetic'}});
    await storage.db.prepare("INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,file_key,file_name,file_type,status,display_name,rating,review,created_at) VALUES (?,?,'exit-public','2026-10-01','Fixture car','Inspektion & Wartung','Rechnung',?,'original.pdf','application/pdf',?,'Synthetic customer',5,'Synthetic restored review','2026-10-11')").bind(id,stable(name),object.key,status).run();
   }
   for(const [id,state,visitId] of [['exit-unknown','unknown',foreignReview],['exit-pinned','pending',pinnedReview]])await storage.db.prepare("INSERT INTO review_notifications (id,visit_id,owner,revision,decision,operation_token,state,attempts,next_attempt_at,created_at,first_attempt_at,payload,provider_key_hash,transport) VALUES (?,?,?,0,'published','synthetic-operation',?,1,0,'2026-10-11',?,'synthetic historical bytes','synthetic-old-credential','resend')").bind(id,visitId,stable('foreign'),state,Date.now()).run();
  },{cloudflare:true});
  const target=join(parent,'target'),options={sourceDirectory:backup.backupDirectory,expectedProjectId:backup.snapshot.projectId,expectedCommit:backup.snapshot.sourceCommit,directory:target};
  await restoreNodeBackup(options);assert.equal((await restoreNodeBackup(options)).unchanged,true);
  const storage=backup.api.createNodeStorage(target);
  try{
   globalThis.providerExitEnv={DB:storage.db,BUCKET:storage.bucket};
   for(const [name,subject] of Object.entries(ids))assert.equal(await backup.api.linkAccountIdentity({provider:'supabase',issuer:sourceOrigin,subject},{provider:'supabase',issuer:targetOrigin,subject},verify),stable(name));
   await storage.db.prepare("UPDATE auth_settings SET project_url=?,public_key=?,updated_at='2026-10-12' WHERE id='main'").bind(targetOrigin,key).run();
  }finally{storage.close();delete globalThis.providerExitEnv;}
  await assert.rejects(restoreNodeBackup(options),/changed|active/i,'An identity-configured target cannot replay the old backup');
  const environment={...process.env,RIPARIM_DATA_DIR:target,SITE_ORIGIN:publicOrigin,AUTH_TRUSTED_ORIGIN:targetOrigin,SUPABASE_SECRET_KEY_ORIGIN:targetOrigin,SUPABASE_SECRET_KEY:secret,EMAIL_TRANSPORT:'smtp',SMTP_URL:'smtp://127.0.0.1:'+mail.address().port,TRANSACTIONAL_EMAIL_FROM:'Riparim <no-reply@example.test>',REVIEW_MODERATOR_EMAIL:'bootstrap@example.test',RIPARIM_TRUSTED_PROXIES:'',NODE_EXTRA_CA_CERTS:caPath,NEXT_TELEMETRY_DISABLED:'1'};delete environment.NODE_TLS_REJECT_UNAUTHORIZED;
  await start(environment,port,'127.0.0.1',false);
  const jar=()=>new Map(),memberJar=jar(),foreignJar=jar(),adminJar=jar();
  async function call(path,{method='GET',body,cookies=memberJar,headers={}}={}){
   const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:publicOrigin,...(body?{'Content-Type':'application/json'}:{}),Cookie:[...cookies].map(([name,value])=>name+'='+value).join('; '),...headers},...(body?{body:JSON.stringify(body)}:{})});
   for(const cookie of response.headers.getSetCookie()){const [pair,...attributes]=cookie.split(';'),at=pair.indexOf('='),name=pair.slice(0,at),value=pair.slice(at+1);if(attributes.some(item=>/max-age=0/i.test(item)))cookies.delete(name);else cookies.set(name,value);}
   return response;
  }
  const login=(name,cookies)=>call('/api/auth/login',{method:'POST',body:{email:'fixture-'+name+'@example.test',password:'synthetic-password-123'},cookies});
  assert.deepEqual((await (await call('/api/workshops')).json()).workshops.map(item=>item.id),['exit-public']);
  assert.equal((await call('/werkstatt/exit-hidden')).status,404);assert.equal((await call('/werkstatt/exit-public')).status,200);
  const forged={'oai-authenticated-user-id':'synthetic-admin','oai-authenticated-user-email':'bootstrap@example.test','oai-authenticated-user-full-name':'Admin'};
  assert.equal((await call('/api/visits?moderation=1',{headers:forged})).status,401);
  assert.equal((await login('member',memberJar)).status,200);
  assert.equal((await (await call('/api/session',{headers:forged})).json()).isAdmin,false,'Metadata and native forged headers cannot upgrade the migrated member');
  const own=await (await call('/api/visits')).json();assert.deepEqual(own.visits.map(item=>item.id),[reviewId]);
  const downloaded=await call('/api/evidence/'+reviewId);assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('Cache-Control'),'private, no-store');assert.equal(await downloaded.text(),'%PDF-1.7 synthetic original private evidence');
  assert.equal((await call('/api/evidence/'+foreignReview)).status,404);assert.equal((await call('/api/visits?id='+foreignReview)).status,404);
  assert.equal((await call('/api/visits',{method:'PATCH',body:{action:'moderate',id:reviewId,status:'published',note:'Synthetic decision',revision:0},headers:forged})).status,403);
  assert.equal((await login('foreign',foreignJar)).status,200);assert.equal((await call('/api/evidence/'+reviewId,{cookies:foreignJar})).status,404);
  for(const name of ['blocked','deleted'])assert.equal((await login(name,jar())).status,403,'Restored app blocks/tombstones survive verified target Auth');
  assert.equal((await login('admin',adminJar)).status,200);assert((await (await call('/api/session',{cookies:adminJar})).json()).isAdmin);
  assert.equal((await call('/api/visits',{method:'PATCH',cookies:adminJar,body:{action:'moderate',id:reviewId,status:'published',note:'Synthetic decision for isolated fixture',revision:0}})).status,200);
  assert.equal(messages.length,1,'A real isolated SMTP server accepts the target notification once');assert.match(messages[0],/fixture-member@example.test/);assert.match(messages[0],/lang=3D"en"/);assert(!messages[0].includes('synthetic original private evidence'));assert(!messages[0].includes('Synthetic decision for isolated fixture'));
  const publicReviews=await (await call('/api/reviews?workshop=exit-public')).json();assert.equal(publicReviews.reviews.length,3);
  assert.equal((await call('/api/account',{method:'POST',body:{password:'synthetic-password-123'}})).status,200);
  assert.equal((await call('/api/account',{method:'DELETE',body:{confirmation:'KONTO LÖSCHEN'}})).status,200);assert(!members.has(ids.member));assert(sourceMembers.has(ids.member),'Target deletion cannot alter the old provider fixture');
  assert.equal((await call('/api/evidence/'+reviewId,{cookies:adminJar})).status,404);assert.equal((await (await call('/api/reviews?workshop=exit-public')).json()).reviews.length,2);
  assert.equal((await call('/api/visits',{method:'PATCH',cookies:adminJar,body:{action:'moderate',id:foreignReview,status:'needs_more',note:'Synthetic second decision',revision:0}})).status,200);assert.equal(messages.length,2);
  await stop();
  await promisify(execFile)(process.execPath,['.node-runtime/command.mjs','notifications'],{env:environment,timeout:30000});assert.equal(messages.length,2,'Transport-pinned old events are not resent through SMTP');
  const db=new DatabaseSync(join(target,'app.sqlite'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT COUNT(*) n FROM visits WHERE owner=?').get(stable('member')).n,0);assert.equal(db.prepare('SELECT status FROM auth_account_status WHERE account_id=?').get(stable('member')).status,'deleted');assert.equal(db.prepare("SELECT state FROM review_notifications WHERE id='exit-unknown'").get().state,'unknown');assert.equal(db.prepare("SELECT transport FROM review_notifications WHERE id='exit-pinned'").get().transport,'resend');assert.equal(db.prepare("SELECT state FROM review_notifications WHERE id='exit-pinned'").get().state,'blocked');assert.equal(db.prepare("SELECT last_error FROM review_notifications WHERE id='exit-pinned'").get().last_error,'credential_changed');assert.equal(db.prepare('SELECT COUNT(*) n FROM auth_identities WHERE account_id=?').get(stable('member')).n,2);}finally{db.close();}
  // The new writer is paused before taking a fresh reverse-transfer snapshot.
  const token='c'.repeat(64),maintenance={...environment,MIGRATION_READ_ONLY:'true',MIGRATION_SOURCE_COMMIT:'d'.repeat(40),MIGRATION_EXPORT_TOKEN_SHA256:createHash('sha256').update(token).digest('hex'),MIGRATION_EXPORT_EXPIRES_AT:new Date(Date.now()+3600000).toISOString()};
  await start(maintenance,port,'127.0.0.1',false);assert.equal((await call('/api/session')).status,503);
  const request=(url,options)=>fetch(new URL(new URL(url).pathname+new URL(url).search,origin),options);
  const fresh=await exportSource({origin:publicOrigin,token,expectedProjectId:backup.snapshot.projectId,expectedCommit:'d'.repeat(40),directory:join(parent,'reverse-backup'),request});
  await stop();
  const originalMetadata=backup.manifest.objects.find(item=>item.key==='unreferenced/private.bin'),returnedMetadata=fresh.manifest.objects.find(item=>item.key===originalMetadata.key);assert.deepEqual(returnedMetadata.httpMetadata,originalMetadata.httpMetadata);assert.deepEqual(returnedMetadata.customMetadata,originalMetadata.customMetadata);assert.equal(returnedMetadata.etag,originalMetadata.etag);assert.equal(returnedMetadata.uploaded,originalMetadata.uploaded);assert.equal(returnedMetadata.sha256,originalMetadata.sha256);
  assert(!fresh.snapshot.tables.find(item=>item.name==='visits').rows.some(item=>item.id===reviewId),'Reverse backup carries target deletions');assert.equal(fresh.snapshot.tables.find(item=>item.name==='auth_account_status').rows.find(item=>item.account_id===stable('member')).status,'deleted');
  await restoreNodeBackup({sourceDirectory:join(parent,'reverse-backup'),expectedProjectId:fresh.snapshot.projectId,expectedCommit:'d'.repeat(40),directory:join(parent,'reverse-target')});
  await start({...environment,RIPARIM_DATA_DIR:join(parent,'reverse-target')},port,'127.0.0.1',false);assert.equal((await call('/api/evidence/'+reviewId,{cookies:adminJar})).status,404);assert.equal((await (await call('/api/reviews?workshop=exit-public')).json()).reviews.length,1);await stop();
  await promisify(execFile)(process.execPath,['.node-runtime/command.mjs','notifications'],{env:{...environment,RIPARIM_DATA_DIR:join(parent,'reverse-target')},timeout:30000});
  const sent=fresh.snapshot.tables.find(item=>item.name==='review_notifications').rows;assert(sent.some(item=>item.visit_id===foreignReview&&item.state==='sent'&&item.transport==='smtp'),'Fresh reverse backup preserves actual target SMTP acceptance');
  await assert.rejects(restoreNodeBackup(options),/changed|active/i,'The stale original backup cannot revive deleted customer data');assert.equal(messages.length,2,'Reverse restore cannot resend accepted or unknown messages');
  assert(requests.some(item=>item.path==='/auth/v1/token'));assert(requests.some(item=>item.path==='/auth/v1/admin/users/'+ids.member&&item.method==='DELETE'));
  console.log('Provider exit over actual Next HTTP: verified alternate HTTPS Auth, stable ownership/roles/blocks, restored private downloads, moderation, isolated SMTP, deletion and fresh reverse restore passed');
 }finally{await stop();for(const socket of sockets)socket.destroy();await Promise.all([sourceAuth,targetAuth,mail].map(server=>new Promise(resolve=>server.close(resolve))));delete globalThis.providerExitEnv;}
}
