import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer,request} from 'node:https';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

export async function pocketbaseNodeHttp({directory,port,start,stop}){
 const target=join(directory,'pocketbase-http');await mkdir(target);
 await promisify(execFile)(process.execPath,['.node-runtime/command.mjs','migrate'],{env:{...process.env,RIPARIM_DATA_DIR:target}});
 const module=join(directory,'pocketbase-storage.mjs'),bundled=await build({entryPoints:['lib/runtime/node-storage.ts'],bundle:true,platform:'node',format:'esm',write:false,packages:'external'});await writeFile(module,bundled.outputFiles[0].contents);
 const {createNodeStorage}=await import(module),storage=createNodeStorage(target);
 const member='memberrecord001',admin='adminrecord0001',key='synthetic-pb-admin-key',owner='supabase:previous-fixture.supabase.co:00000000-0000-4000-8000-000000000001',adminOwner='opaque-pb-admin',visit='10000000-0000-4000-8000-000000000001';
 const records=new Map([[member,{id:member,collectionId:'_pb_users_auth_',collectionName:'users',email:'member@example.test',verified:true,name:'Synthetic PB Node member',preferredLocale:'en',role:'admin',isAdmin:true}],[admin,{id:admin,collectionId:'_pb_users_auth_',collectionName:'users',email:'admin@example.test',verified:true,name:'Synthetic PB Node admin',preferredLocale:'en'}]]),tokens=new Map();let sequence=0;
 const tls={key:await readFile('tests/fixtures/smtp/key.pem'),cert:await readFile('tests/fixtures/smtp/cert.pem')},sockets=new Set();
 const provider=createServer(tls,async(req,res)=>{
  const url=new URL(req.url,'https://'+req.headers.host),chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
  const json=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
  if(url.pathname==='/api/collections/users/auth-methods')return json({password:{enabled:true,identityFields:['email']},oauth2:{enabled:false,providers:[]},mfa:{enabled:false}});
  if(url.pathname==='/api/collections/users/auth-with-password'){const record=[...records.values()].find(value=>value.email===body.identity);if(!record||body.password!=='synthetic-password-123')return json({status:400,data:{}},400);const token='opaque-pb-node-token-'+(++sequence);tokens.set(token,record.id);return json({token,record});}
  if(url.pathname==='/api/collections/users/auth-refresh'){const record=records.get(tokens.get(req.headers.authorization));return record?json({token:'unused-refresh-token',record}):json({status:401,data:{}},401);}
  if(url.pathname==='/api/collections/_externalAuths/records')return tokens.has(req.headers.authorization)?json({items:[],totalItems:0}):json({status:401,data:{}},401);
  if(req.headers.authorization!==key)return json({status:403,data:{}},403);
  if(url.pathname==='/api/collections/users/records')return json({items:[...records.values()],totalItems:records.size});
  const id=url.pathname.split('/').at(-1),record=records.get(id);if(!record)return json({status:404,data:{}},404);
  if(req.method==='PATCH')Object.assign(record,body);return json(record);
 });provider.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
 const issuer='https://127.0.0.1:'+provider.address().port,publicOrigin='https://pocketbase-node.fixture.invalid',origin='http://127.0.0.1:'+port;
 try{
  const catalogue=JSON.parse(await readFile('data/workshops.json','utf8')),marker='workshop-source:'+createHash('sha256').update(JSON.stringify(catalogue)).digest('hex');await storage.db.prepare('INSERT INTO catalog_state VALUES (?,?)').bind(marker,'fixture').run();
  await storage.db.prepare("INSERT INTO workshops (id,name,city,address,phone,brands,services,specialty,description,sources,checked_at,status,updated_at) VALUES ('pb-node-public','Synthetic PB Node workshop','Prishtina','Fixture road','+38344123456','[]','[]','Fixture','Synthetic','[]','2026-10-12','published','2026-10-12')").run();
  await storage.db.prepare("INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at,provider) VALUES ('main',?,'',1,0,'2026-10-12','pocketbase')").bind(issuer).run();
  for(const [subject,account] of [[member,owner],[admin,adminOwner]])await storage.db.prepare('INSERT INTO auth_identities VALUES (?,?,?,?,?)').bind('pocketbase',issuer,subject,account,'2026-10-12').run();
  await storage.db.prepare("INSERT INTO auth_account_roles VALUES (?,'admin','2026-10-12','fixture-bootstrap')").bind(adminOwner).run();
  const file='evidence/'+owner+'/'+visit+'/fixture.pdf';await storage.bucket.put(file,'%PDF-private synthetic PB Node evidence',{httpMetadata:{contentType:'application/pdf'}});
  await storage.db.prepare("INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,file_key,file_type,status,created_at) VALUES (?,?,'pb-node-public','2026-10-12','Fixture car','Repair','document',?,'application/pdf','published','2026-10-12')").bind(visit,owner,file).run();storage.close();
  const environment={...process.env,RIPARIM_DATA_DIR:target,SITE_ORIGIN:publicOrigin,AUTH_TRUSTED_ORIGIN:issuer,AUTH_TRUSTED_PROVIDER:'pocketbase',AUTH_ADMIN_KEY:key,AUTH_ADMIN_KEY_ORIGIN:issuer,AUTH_ADMIN_KEY_PROVIDER:'pocketbase',REVIEW_MODERATOR_EMAIL:'bootstrap@example.test',RIPARIM_TRUSTED_PROXIES:'',NODE_EXTRA_CA_CERTS:new URL('../fixtures/smtp/cert.pem',import.meta.url).pathname,NEXT_TELEMETRY_DISABLED:'1'};delete environment.NODE_TLS_REJECT_UNAUTHORIZED;
  await start(environment,port,'127.0.0.1',false);
  const memberJar=new Map(),adminJar=new Map();
  async function call(path,{method='GET',body,jar=memberJar,extra={}}={}){const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:publicOrigin,Cookie:[...jar].map(([name,value])=>name+'='+value).join('; '),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});for(const cookie of response.headers.getSetCookie()){const [pair,...flags]=cookie.split(';'),at=pair.indexOf('='),name=pair.slice(0,at);if(flags.some(flag=>/max-age=0/i.test(flag)))jar.delete(name);else jar.set(name,pair.slice(at+1));}return response;}
  const login=(email,jar)=>call('/api/auth/login',{method:'POST',body:{email,password:'synthetic-password-123'},jar});
  assert.equal((await login('member@example.test',memberJar)).status,200);const session=await (await call('/api/session')).json();assert.equal(session.account.displayName,'Synthetic PB Node member');assert.equal(session.isAdmin,false);
  assert.equal((await (await call('/api/session')).json()).account.displayName,session.account.displayName,'Repeated upstream auth-refresh does not lose the enrolled app grant');
  assert.equal(await (await call('/api/evidence/'+visit)).text(),'%PDF-private synthetic PB Node evidence');assert.equal((await call('/api/visits?moderation=1',{extra:{'oai-authenticated-user-email':'bootstrap@example.test'}})).status,403);
  assert.equal((await call('/api/account',{method:'PATCH',body:{preferredLocale:'sq'}})).status,200);assert.equal(records.get(member).preferredLocale,'sq');
  assert.equal((await call('/api/account',{method:'POST',body:{password:'synthetic-password-123'}})).status,200,'Password proof uses an isolated provider session on the true Node HTTP path');
  assert.equal((await login('admin@example.test',adminJar)).status,200);assert.equal((await call('/api/users',{jar:adminJar})).status,200);
  assert.equal((await call('/api/auth-settings',{method:'POST',body:{provider:'supabase',projectUrl:'https://replacement.supabase.co',publicKey:'sb_publishable_fixture_key_1234567890',enabled:false},jar:adminJar})).status,400,'An active protocol switch is rejected before deactivation');
  const links=await call('/en/privacy');assert((await links.text()).includes('PocketBase'),'Actual Node privacy page describes the selected provider');
  assert.equal((await call('/api/auth/logout',{method:'POST',body:{}})).status,200);assert.equal((await call('/api/evidence/'+visit)).status,401);
  console.log('Actual Node HTTPS PocketBase: independent REST, new runtime bindings, stable refresh, mapped private ownership, profile/re-auth, internal admin role, controlled switch, privacy and logout passed.');
 }finally{await stop();for(const socket of sockets)socket.destroy();await new Promise(resolve=>provider.close(resolve));try{storage.close();}catch{}}
}
