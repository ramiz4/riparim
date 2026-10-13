import {catalogueFixtureKey} from './catalogue-fixture-key.mjs';
import assert from 'node:assert/strict';
import {assertPrivacyOutput} from './privacy-output.mjs';
import {localizeHref} from '../../scripts/lib/locale.mjs';
import {build} from 'esbuild';
import {createServer} from 'node:https';
import {readFile,mkdir,writeFile,cp} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';

export async function pocketbaseNodeHttp({directory,port,start,stop}){
 const target=join(directory,'pocketbase-http');await mkdir(target);
 await promisify(execFile)(process.execPath,['.node-runtime/command.mjs','migrate'],{env:{...process.env,RIPARIM_DATA_DIR:target}});
 globalThis.pocketbaseNodeEnv={};
 const storageModule=join(directory,'pocketbase-storage.mjs'),bundled=await build({stdin:{contents:"export * from './lib/runtime/node-storage';export {linkAccountIdentity} from './lib/auth/identities';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,packages:'external',plugins:[{name:'private-operator-runtime',setup(b){b.onResolve({filter:/^@\/lib\/runtime\/env$/},()=>({path:'env',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const env=globalThis.pocketbaseNodeEnv;'}));}}]});await writeFile(storageModule,bundled.outputFiles[0].contents);
 const {createNodeStorage,linkAccountIdentity}=await import(storageModule),storage=createNodeStorage(target);
 const member='memberrecord001',admin='adminrecord0001',key='synthetic-pb-admin-key',owner='supabase:previous-fixture.supabase.co:00000000-0000-4000-8000-000000000001',adminOwner='opaque-pb-admin',visit='10000000-0000-4000-8000-000000000001';
 const records=new Map([[member,{id:member,collectionId:'_pb_users_auth_',collectionName:'users',email:'member@example.test',verified:true,name:'Synthetic PB Node member',preferredLocale:'en',role:'admin',isAdmin:true}],[admin,{id:admin,collectionId:'_pb_users_auth_',collectionName:'users',email:'admin@example.test',verified:true,name:'Synthetic PB Node admin',preferredLocale:'en'}]]),tokens=new Map();let sequence=0;
 const tls={key:await readFile('tests/fixtures/smtp/key.pem'),cert:await readFile('tests/fixtures/smtp/cert.pem')},sockets=new Set();
 const handler=(records,key)=>async(req,res)=>{
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
 };const provider=createServer(tls,handler(records,key));provider.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
 let targetProvider;
 const issuer='https://127.0.0.1:'+provider.address().port,publicOrigin='https://pocketbase-node.fixture.invalid',origin='http://127.0.0.1:'+port;
 try{
  const marker=await catalogueFixtureKey();await storage.db.prepare('INSERT INTO catalog_state VALUES (?,?)').bind(marker,'fixture').run();
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
  assert.equal((await call('/api/auth-settings',{method:'POST',body:{provider:'pocketbase',projectUrl:issuer,publicKey:'',enabled:false,emailDeliveryConfirmed:false},jar:adminJar})).status,200);
  assert.equal((await call('/api/auth-settings',{jar:adminJar})).status,401,'Disabling customer auth also removes a Node web administrator with no separate native identity');
  assert.equal((await call('/api/auth-settings',{method:'POST',body:{provider:'pocketbase',projectUrl:issuer,publicKey:'',enabled:true},jar:adminJar})).status,401,'The disabled Node profile cannot be reactivated through a hidden public bootstrap');
  await stop();
  await cp(target,join(directory,'pocketbase-before-cutover'),{recursive:true});
  const targetKey='synthetic-pb-target-admin-key',targetMember='memberrecord002',targetAdmin='adminrecord0002',targetRecords=new Map([[targetMember,{...records.get(member),id:targetMember}],[targetAdmin,{...records.get(admin),id:targetAdmin}]]);
  targetProvider=createServer(tls,handler(targetRecords,targetKey));targetProvider.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(resolve=>targetProvider.listen(0,'127.0.0.1',resolve));
  const nextIssuer='https://127.0.0.1:'+targetProvider.address().port,privateStorage=createNodeStorage(target);Object.assign(globalThis.pocketbaseNodeEnv,{DB:privateStorage.db,BUCKET:privateStorage.bucket});
  const verify=identity=>new Promise((resolve,reject)=>{
   const credential=identity.issuer===issuer?key:identity.issuer===nextIssuer?targetKey:null;if(!credential||identity.provider!=='pocketbase')return resolve(false);
   import('node:https').then(({request})=>{const req=request(new URL('/api/collections/users/records/'+identity.subject,identity.issuer),{ca:tls.cert,headers:{Authorization:credential}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{try{resolve(res.statusCode===200&&JSON.parse(Buffer.concat(chunks)).id===identity.subject);}catch(error){reject(error);}});});req.on('error',reject);req.end();}).catch(reject);
  });
  for(const [sourceSubject,targetSubject,account] of [[member,targetMember,owner],[admin,targetAdmin,adminOwner]])assert.equal(await linkAccountIdentity({provider:'pocketbase',issuer,subject:sourceSubject},{provider:'pocketbase',issuer:nextIssuer,subject:targetSubject},verify),account);
  privateStorage.close();delete globalThis.pocketbaseNodeEnv;
  const instructions=await readFile('docs/auth-provider.md','utf8'),operator=instructions.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\nNODE/)[1];
  const checkedOperation=operator.replace("provider:'supabase',issuer:'https://source.example.test'",`provider:'pocketbase',issuer:'${issuer}'`).replace('https://target.example.test',nextIssuer).replace('/opt/riparim/shared/data/app.sqlite',join(target,'app.sqlite'));
  const {spawn}=await import('node:child_process'),configure=spawn(process.execPath,['--input-type=module'],{stdio:['pipe','pipe','pipe']});let output='';configure.stderr.on('data',chunk=>output+=chunk);configure.stdin.end(checkedOperation);assert.equal(await new Promise(resolve=>configure.on('close',resolve)),0,output);

  await start({...environment,AUTH_TRUSTED_ORIGIN:nextIssuer,AUTH_ADMIN_KEY:targetKey,AUTH_ADMIN_KEY_ORIGIN:nextIssuer},port,'127.0.0.1',false);
  assert.equal((await (await call('/api/session',{jar:adminJar})).json()).isAdmin,false,'Old issuer cookies cannot reuse even an unchanged internal admin role');
  assert.equal((await call('/api/evidence/'+visit)).status,401,'Old source browser grants remain revoked');memberJar.clear();adminJar.clear();
  assert.equal((await login('member@example.test',memberJar)).status,200);assert.equal((await (await call('/api/session')).json()).isAdmin,false);
  assert.equal(await (await call('/api/evidence/'+visit)).text(),'%PDF-private synthetic PB Node evidence','Private operator cutover retains the original stable ownership and file path');
  assert.equal((await login('admin@example.test',adminJar)).status,200);assert.equal((await (await call('/api/session',{jar:adminJar})).json()).isAdmin,true);assert.equal((await call('/api/users',{jar:adminJar})).status,200,'A fresh target-provider login restores the existing independently held administrative role');
  for(const locale of ['de','sq','en'])for(const init of [{},{method:'HEAD'},{extra:{RSC:'1',Accept:'text/x-component'}}]){
   const response=await call(localizeHref('/datenschutz',locale)+(init.extra?'?_rsc':''),init);assert.equal(response.status,200,`${locale} ${JSON.stringify(init)} ${response.headers.get('location')}`);
   const output=await response.text();if(init.method==='HEAD')assert.equal(output,'');else {assertPrivacyOutput(output,locale,'pocketbase');if(init.extra)assert.match(response.headers.get('content-type'),/text\/x-component/);}
  }
  assert.equal((await call('/api/auth/logout',{method:'POST',body:{}})).status,200);assert.equal((await call('/api/evidence/'+visit)).status,401);
  console.log('Actual Node HTTPS PocketBase: independent REST, new runtime bindings, stable refresh, mapped private ownership, profile/re-auth, internal admin role, disabled web-admin refusal, private checked operator cutover, privacy and logout passed.');
 }finally{await stop();for(const socket of sockets)socket.destroy();await new Promise(resolve=>provider.close(resolve));if(targetProvider)await new Promise(resolve=>targetProvider.close(resolve));delete globalThis.pocketbaseNodeEnv;try{storage.close();}catch{}}
}
