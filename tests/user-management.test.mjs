import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';

const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const output='.test-runtime/user-management';
const fixture=(kind)=>({name:`user-management-${kind}`,setup(b){
 b.onResolve({filter:/^(cloudflare:workers|@\/lib\/auth\/admin|@\/app\/auth|@\/app\/chatgpt-auth|\.\/chatgpt-auth|@\/lib\/auth\/client|@\/db\/directory|@supabase\/supabase-js)$/},args=>{
  if(kind==='auth'&&args.path==='@/app/auth')return;
  return {path:args.path,namespace:'fixture'};
 });
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:
  args.path==='cloudflare:workers'?'export const env=globalThis.fixtureEnv;':
  args.path==='@supabase/supabase-js'?'export function createClient(...args){return globalThis.fixtureCreateClient(...args);}':
  args.path==='@/db/directory'?'export async function publishedWorkshop(){return {id:"fixture-workshop",status:"published"};}':
  args.path==='@/lib/auth/admin'?'export async function getAuthAdmin(){return globalThis.fixtureAuthAdmin;}':
  args.path==='@/app/auth'?'export async function getAdminUser(){return globalThis.fixtureAdmin;} export async function getAppUser(){return globalThis.fixtureVisitor;} export function ownerPair(user){return [user.ownerKeys[0],user.ownerKeys[1]??user.ownerKeys[0]];} export function ownsVisit(user,owner){return user.ownerKeys.includes(owner);} export function providerAccountId(url,id){return `supabase:${new URL(url).hostname}:${id}`;}':
  args.path.includes('chatgpt-auth')?'export async function getChatGPTUser(){return globalThis.fixtureNative;}':
  'export async function authClient(){return globalThis.fixtureClient;}'
 }));
}});
await mkdir(output,{recursive:true});
for(const [kind,entryPoints] of [['routes',{collection:'app/api/users/route.ts',item:'app/api/users/[id]/route.ts',visits:'app/api/visits/route.ts'}],['auth',{auth:'app/auth.ts'}],['provider',{adminProvider:'lib/auth/admin.ts'}]]){
 const bundle=await build({entryPoints,bundle:true,format:'esm',platform:'node',outdir:output,write:false,plugins:[fixture(kind)]});
 for(const file of bundle.outputFiles)await writeFile(file.path.replace(/\.js$/,'.mjs'),file.contents);
}

const db=new DatabaseSync(':memory:');
// Include the visit table because account deletion must remove owned visits and files.
for(const name of ['0000_handy_black_queen','0001_polite_killmonger','0002_exotic_slayback','0003_magenta_boom_boom','0004_ambiguous_morbius','0007_pink_tyrannus','0008_stormy_blazing_skull','0009_fine_sister_grimm','0010_handy_luminals','0011_funny_echo','0012_unique_wolfsbane'])db.exec(await readFile(`drizzle/${name}.sql`,'utf8'));
let failDatabase=false;
let beforeRun=null;
let beforeFirst=null;
let beforeBatch=null,batchTail=Promise.resolve();
const d1={batch(statements){
 const pending=batchTail.then(async()=>{
  if(failDatabase)throw Error('Fixture database unavailable');
  if(beforeBatch)beforeBatch();
  db.exec('BEGIN');
  try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}
  catch(error){db.exec('ROLLBACK');throw error;}
 });
 batchTail=pending.catch(()=>{});return pending;
},prepare(sql){
 const statement=db.prepare(sql);
 const adapter=(values=[])=>({
  first:async()=>{if(failDatabase)throw Error('Fixture database unavailable');if(beforeFirst)beforeFirst(sql);return statement.get(...values)??null;},
  run:async()=>{if(failDatabase)throw Error('Fixture database unavailable');if(beforeRun)beforeRun(sql,values);return {meta:statement.run(...values)};},
  all:async()=>{if(failDatabase)throw Error('Fixture database unavailable');return {results:statement.all(...values)};},
  bind:(...next)=>adapter(next),
 });
 return adapter();
}};
const objects=new Map();
let failBucket=false;
const bucket={
 async list({prefix,cursor}){if(failBucket)throw Error('Fixture evidence unavailable');const keys=[...objects.keys()].filter(key=>key.startsWith(prefix)&&(!cursor||key>cursor)).sort(),page=keys.slice(0,1);return {objects:page.map(key=>({key})),truncated:page.length<keys.length,cursor:page.at(-1)};},
 async delete(keys){if(failBucket)throw Error('Fixture evidence unavailable');for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key);},
 async put(key,bytes,options){if(options?.onlyIf&&!objects.has(key))return null;objects.set(key,true);return {etag:key};},
 async head(key){return objects.has(key)?{key}:null;},
};
const projectUrl='https://fixture-project.supabase.co',origin='https://riparim.example.test';
const moderatorEmail='owner@example.test';
globalThis.fixtureEnv={DB:d1,BUCKET:bucket,REVIEW_MODERATOR_EMAIL:moderatorEmail,SITE_ORIGIN:origin};
globalThis.fixtureNative=null;
const ids={current:'00000000-0000-4000-8000-000000000001',moderator:'00000000-0000-4000-8000-000000000002',member:'aabbccdd-0000-4000-8000-000000000003',other:'00000000-0000-4000-8000-000000000004',created:'00000000-0000-4000-8000-000000000005',failure:'00000000-0000-4000-8000-000000000006'};
const accountId=id=>`supabase:${new URL(projectUrl).hostname}:${id}`;
const moderator={userId:accountId(ids.current),email:'current-admin@example.test',displayName:'Fixture Admin',fullName:'Fixture Admin',ownerKeys:[accountId(ids.current)],provider:'Google',isModerator:true};
globalThis.fixtureAdmin=moderator;
const providerUser=(id,email,name,providers=['email'])=>({id,email,email_confirmed_at:'2026-10-04T08:00:00Z',created_at:'2026-10-01T08:00:00Z',last_sign_in_at:'2026-10-04T08:00:00Z',user_metadata:{full_name:name},app_metadata:{providers},identities:providers.map(provider=>({provider})),aud:'authenticated',role:'authenticated'});
const users=new Map([
 [ids.current,providerUser(ids.current,moderator.email,'Current Admin',['google'])],
 [ids.moderator,providerUser(ids.moderator,moderatorEmail,'Configured Owner',['google'])],
 [ids.member,providerUser(ids.member,'member@example.test','Fixture Member')],
 [ids.other,providerUser(ids.other,'other@example.test','Other Member')],
 [ids.failure,providerUser(ids.failure,'failure@example.test','Failure Member')],
]);
const calls=[];
let providerError=null;
let providerPagination=null;
const result=(data)=>({data,error:providerError});
const authAdmin={
 async listUsers(options){calls.push({method:'listUsers',options});if(providerPagination)return result(providerPagination);const page=options?.page??1,perPage=options?.perPage??50,all=[...users.values()];return result({users:all.slice((page-1)*perPage,page*perPage),total:all.length,lastPage:Math.ceil(all.length/perPage),nextPage:page*perPage<all.length?page+1:null});},
 async getUserById(id){calls.push({method:'getUserById',id});return users.has(id)?{data:{user:users.get(id)},error:null}:{data:{user:null},error:{status:404,code:'user_not_found',message:'Fixture user not found'}};},
 async createUser(body){calls.push({method:'createUser',body});if(providerError)return result({user:null});const user={...providerUser(ids.created,body.email,body.user_metadata?.full_name??''),email_confirmed_at:body.email_confirm?'2026-10-04T08:00:00Z':null};if(body.ban_duration&&body.ban_duration!=='none')user.banned_until='2126-10-04T08:00:00Z';users.set(user.id,user);return result({user});},
 async updateUserById(id,body){calls.push({method:'updateUserById',id,body});if(providerError)return result({user:null});const before=users.get(id),user={...before,...(body.email?{email:body.email}:{}),...(body.user_metadata?{user_metadata:{...before.user_metadata,...body.user_metadata}}:{})};if(body.ban_duration)user.banned_until=body.ban_duration==='none'?null:'2126-10-04T08:00:00Z';users.set(id,user);return result({user});},
 async deleteUser(id){calls.push({method:'deleteUser',id});if(providerError)return result({user:null});const user=users.get(id);users.delete(id);return result({user});},
};
globalThis.fixtureAuthAdmin={client:{auth:{admin:authAdmin}},projectUrl};
db.prepare("INSERT INTO auth_settings VALUES ('main',?,?,1,1,?)").run(projectUrl,'sb_publishable_fixture_public_key_1234567890','2026-10-04');
const load=name=>import(new URL(`../${output}/${name}.mjs`,import.meta.url));
const [collection,item,auth,visits]=await Promise.all(['collection','item','auth','visits'].map(load));
const adminProvider=await load('adminProvider');
let passed=0;
const check=(value,label)=>{assert(value,label);passed++;};
const request=(path,method='GET',body,headers={})=>new Request(origin+path,{method,headers:{Origin:origin,...(body!==undefined?{'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
const list=query=>collection.GET(request('/api/users'+(query?'?'+query:'')));
const create=(body,headers)=>collection.POST(request('/api/users','POST',body,headers));
const update=(id,body,headers)=>item.PATCH(request('/api/users/'+id,'PATCH',body,headers),{params:Promise.resolve({id})});
const remove=(id,headers)=>item.DELETE(request('/api/users/'+id,'DELETE',undefined,headers),{params:Promise.resolve({id})});
const status=id=>db.prepare('SELECT status FROM auth_account_status WHERE account_id=?').get(accountId(id))?.status;
const enroll=id=>{const key='session-'+id;db.prepare('INSERT INTO auth_sessions (id,account_id,revoked,legacy_access,expires_at,created_at,provider) VALUES (?,?,0,1,?,?,?) ON CONFLICT(id) DO UPDATE SET revoked=0').run(key,accountId(id),Date.now()+86400000,'2026-10-04','password');return key;};
const sessionRevoked=id=>db.prepare('SELECT revoked FROM auth_sessions WHERE account_id=?').get(accountId(id))?.revoked;
const noActiveSessions=id=>db.prepare('SELECT COUNT(*) AS n FROM auth_sessions WHERE account_id=? AND revoked=0').get(accountId(id)).n===0;
const accountRole=id=>db.prepare('SELECT role FROM auth_account_roles WHERE account_id=?').get(accountId(id))?.role??'user';
const seedAdmin=id=>db.prepare('INSERT INTO auth_account_roles (account_id,role,assigned_at,assigned_by) VALUES (?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET role=excluded.role').run(accountId(id),'admin','2026-10-04',accountId(ids.current));
const visit=(id,owner)=>{db.prepare('INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,file_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id,owner,'fixture-workshop','2026-10-04','Fixture Car','Repair','document',`evidence/${owner}/${id}/document.pdf`,'2026-10-04');objects.set(`evidence/${owner}/${id}/document.pdf`,true);objects.set(`evidence/${owner}/${id}/older.pdf`,true);};
seedAdmin(ids.current);
let signedInUser=null,sessionId='fixture-password-session',method='password';
globalThis.fixtureClient={auth:{getUser:async()=>({data:{user:signedInUser},error:null}),getClaims:async()=>({data:{claims:{sub:signedInUser.id,session_id:sessionId,amr:[{method}]}},error:null}),setSession:async()=>({error:null})}};

globalThis.fixtureAdmin=null;
check((await list()).status===401,'Anonymous visitors cannot list accounts');
check((await create({name:'New',email:'new@example.test',password:'fixture-password-123',active:true})).status===401,'Anonymous visitors cannot create accounts');
check((await update(ids.member,{role:'admin'})).status===401,'Anonymous visitors cannot assign admin roles');
globalThis.fixtureAdmin={...moderator,isModerator:false};
check((await list()).status===403,'Signed-in members cannot list accounts');
check((await update(ids.member,{name:'Forbidden'})).status===403,'Signed-in members cannot edit accounts');
check((await remove(ids.member)).status===403,'Signed-in members cannot delete accounts');
check((await update(ids.member,{role:'admin'})).status===403,'Signed-in members cannot promote themselves');
check(calls.length===0,'Unauthorized requests never call the provider');
globalThis.fixtureAdmin=moderator;
check((await create({name:'New',email:'new@example.test',password:'fixture-password-123',active:true},{Origin:'https://other.example.test'})).status===403,'Creation rejects cross-origin requests');
check((await update(ids.member,{active:false},{'sec-fetch-site':'cross-site'})).status===403,'Status update rejects cross-site requests');
check((await remove(ids.member,{Origin:'https://other.example.test'})).status===403,'Deletion rejects cross-origin requests');
check((await update(ids.member,{role:'admin'},{Origin:'https://other.example.test'})).status===403,'Role changes reject cross-origin requests');
check(calls.length===0,'Cross-origin requests never call the provider');
for(const locale of ['de','sq','en']){
 const invalid=await update(ids.member,{name:'x'},{'Accept-Language':locale}),data=await invalid.json();
 check(invalid.status===400&&data.errorCode==='invalid_name'&&data.error==='Bitte gib einen Namen mit 2 bis 80 Zeichen ein.','Management input codes preserve the same legacy status/text in every language');
}
const originalMetadataUpdate=authAdmin.updateUserById;
try{
 users.set(ids.member,{...users.get(ids.member),user_metadata:{full_name:'Fixture Member',preferred_locale:'de',unrelated:'original'}});
 authAdmin.updateUserById=async(id,attributes)=>{
  const current=users.get(id);users.set(id,{...current,user_metadata:{...current.user_metadata,preferred_locale:'sq',unrelated:'new independent value'}});
  return originalMetadataUpdate.call(authAdmin,id,attributes);
 };
 const updated=await update(ids.member,{name:'Fixture Member'});check(updated.ok,'A valid administrative rename succeeds with a concurrent preference edit');
 const metadata=users.get(ids.member).user_metadata;check(metadata.preferred_locale==='sq'&&metadata.unrelated==='new independent value','An administrative rename must not replay an old language preference or unrelated metadata');
 assert.deepEqual(calls.at(-1).body.user_metadata,{full_name:'Fixture Member'});passed++;
}finally{authAdmin.updateUserById=originalMetadataUpdate;}

let response=await list('page=1&perPage=2'),body=await response.json();
check(response.status===200&&body.configured&&body.page===1&&body.perPage===2&&body.hasMore&&body.users.length===2,'Account listing uses requested pagination and declares configured administration');
check(body.users.every(user=>user.protected)&&body.users[0].providers.includes('google'),'Current and configured owner accounts are visibly protected with their login provider');
check(body.users.every(user=>user.role==='admin'),'Listing shows delegated and bootstrap admin roles');
response=await list('page=2&perPage=2');body=await response.json();
check(body.users.length===2&&body.users[0].id===ids.member&&!body.users[0].protected&&body.users[0].active&&body.users[0].confirmed,'Subsequent page shows ordinary confirmed active accounts');
check(body.users[0].name==='Fixture Member'&&body.users[0].createdAt&&body.users[0].lastSignInAt,'Listing exposes account display and activity information');
check(body.users.every(user=>user.role==='user'),'Ordinary accounts have the user role');
check(!JSON.stringify(body).includes('app_metadata')&&!JSON.stringify(body).includes('user_metadata'),'Responses expose only the account view rather than provider internals');
response=await list('page=3&perPage=2');body=await response.json();
check(body.users.length===1&&!body.hasMore,'The last account page does not offer another page');
providerPagination={users:[...users.values()],total:101,lastPage:11,nextPage:1};
response=await list('page=9&perPage=10');body=await response.json();
check(body.hasMore,'Pagination reaches double-digit pages even when the SDK truncates nextPage=10 to 1');
providerPagination=null;
for(const query of ['page=0','page=-1','page=1.5','perPage=0','perPage=101'])check((await list(query)).status===400,'Invalid pagination is rejected');
check((await update('not-a-uuid',{name:'Fixture'})).status===400&&(await remove('not-a-uuid')).status===400,'Mutation endpoints reject invalid account identifiers');
const missingId='00000000-0000-4000-8000-000000000099';
check((await update(missingId,{name:'Fixture'})).status===404&&(await remove(missingId)).status===404,'Mutation endpoints report unknown accounts');

const invalidCreates=[
 {name:'Fixture',email:'invalid-email',password:'fixture-password-123',active:true},
 {name:'Fixture',email:'valid@example.test',password:'short',active:true},
 {name:'Fixture',email:'valid@example.test',password:'fixture-password-123',active:'false'},
 {name:'Fixture',email:'valid@example.test',password:'fixture-password-123',active:true,isModerator:true},
 {name:'Fixture',email:'valid@example.test',password:'fixture-password-123',active:true,role:'admin'},
 {name:'Fixture',email:moderatorEmail,password:'fixture-password-123',active:true},
];
for(const payload of invalidCreates)check((await create(payload)).status>=400,'Invalid create input, privilege attributes and reserved email are rejected');
check(!calls.some(call=>call.method==='createUser'),'Rejected creation never creates a provider account');
check((await create({name:'Fixture',email:'valid@example.test',password:'fixture-password-123',active:true},{'content-type':'text/plain'})).status>=400,'Mutations require JSON content type');
response=await create({name:'  New Member  ',email:' NEW-MEMBER@example.test ',password:'fixture-password-123',active:false});body=await response.json();
check(response.ok&&body.user.id===ids.created&&body.user.email==='new-member@example.test'&&body.user.name==='New Member'&&!body.user.active,'Admin creates an inactive account with normalized display information');
const creation=calls.find(call=>call.method==='createUser');
check(creation.body.email_confirm===true&&creation.body.password==='fixture-password-123','Admin creation confirms the supplied account and uses the supplied password');
check(status(ids.created)==='inactive','Inactive creation records a durable local access block');
check(!JSON.stringify(body).includes('fixture-password-123'),'Creation response never exposes the password');
check(body.user.role==='user'&&accountRole(ids.created)==='user','Account creation always grants ordinary user rights');

const writesBeforeInvalid=calls.filter(call=>call.method==='updateUserById').length;
for(const payload of [{},{email:'invalid'},{password:'short'},{role:'owner'},{role:'admin',name:'Mixed role edit'},{role:'user',active:false},{active:false,name:'Mixed operation'},{email:moderatorEmail}])check((await update(ids.member,payload)).status>=400,'Invalid edits, invalid or mixed role edits, mixed status edits and reserved owner email are rejected');
check(calls.filter(call=>call.method==='updateUserById').length===writesBeforeInvalid,'Invalid edits never reach the provider');
enroll(ids.member);
response=await update(ids.member,{name:'  Renamed Member  ',email:' RENAMED@example.test ',password:'fixture-replacement-123'});body=await response.json();
check(response.ok&&body.user.name==='Renamed Member'&&body.user.email==='renamed@example.test','Profile edit updates normalized name, email and password');
check(!JSON.stringify(body).includes('fixture-replacement-123'),'Edit response never exposes the password');
check(noActiveSessions(ids.member),'Changing credentials revokes existing app sessions');
for(const protectedId of [ids.current,ids.moderator]){
 check((await update(protectedId,{active:false})).status>=400,'Protected administrator cannot be deactivated');
 check((await update(protectedId,{email:'moved-owner@example.test'})).status>=400,'Protected administrator cannot change the administrator email');
 check((await remove(protectedId)).status>=400,'Protected administrator cannot be deleted');
 check((await update(protectedId,{role:'user'})).status>=400,'Current and bootstrap administrators cannot be demoted');
}

// Role authority comes from D1, independently of provider metadata and login method.
db.prepare('INSERT INTO auth_links (account_id,legacy_owner,owner_admin,created_at,password_access) VALUES (?,?,0,?,1)').run(accountId(ids.member),'legacy-member','2026-10-04');
signedInUser={...users.get(ids.member),user_metadata:{...users.get(ids.member).user_metadata,role:'admin',is_admin:true},app_metadata:{...users.get(ids.member).app_metadata,role:'admin',is_admin:true}};
sessionId='roles-password-before';method='password';await auth.recordPasswordSession(projectUrl,signedInUser,globalThis.fixtureClient);
const ordinaryUser=await auth.getAppUser(),ownershipBefore=ordinaryUser.ownerKeys;
check(!ordinaryUser.isModerator&&ownershipBefore.includes('legacy-member'),'Mutable provider metadata cannot grant admin authority or change account ownership');
beforeFirst=sql=>{if(/SELECT legacy_owner,password_access FROM auth_links/i.test(sql)){beforeFirst=null;seedAdmin(ids.member);db.prepare('UPDATE auth_sessions SET revoked=1 WHERE account_id=?').run(accountId(ids.member));}};
check(await auth.getAppUser()===null,'An old customer session cannot acquire admin rights when promotion revokes it after the initial session read');
beforeFirst=null;db.prepare('DELETE FROM auth_account_roles WHERE account_id=?').run(accountId(ids.member));db.prepare('UPDATE auth_sessions SET revoked=0 WHERE id=?').run(sessionId);
seedAdmin(ids.member);
beforeFirst=sql=>{if(/SELECT legacy_owner,password_access FROM auth_links/i.test(sql)){beforeFirst=null;db.prepare('DELETE FROM auth_account_roles WHERE account_id=?').run(accountId(ids.member));db.prepare('UPDATE auth_sessions SET revoked=1 WHERE account_id=?').run(accountId(ids.member));}};
check(await auth.getAppUser()===null,'A demotion that revokes an admin session after the initial read also denies that request');
beforeFirst=null;db.prepare('UPDATE auth_sessions SET revoked=0 WHERE id=?').run(sessionId);
const providerWritesBeforeRole=calls.filter(call=>['updateUserById','createUser','deleteUser'].includes(call.method)).length;
response=await update(ids.member.toUpperCase(),{role:'admin'});body=await response.json();
check(response.ok&&body.user.role==='admin'&&accountRole(ids.member)==='admin','An administrator can grant a verified email account the admin role');
check(body.roleChanged===true,'An actual promotion reports that the role changed');
const assignment=db.prepare('SELECT assigned_by,assigned_at FROM auth_account_roles WHERE account_id=?').get(accountId(ids.member));
check(assignment.assigned_by===moderator.userId&&assignment.assigned_at,'Role assignments retain the authorized actor and assignment time');
check(await auth.getAppUser()===null&&noActiveSessions(ids.member),'Granting a role revokes every existing session and requires a fresh login');
sessionId='roles-password-admin';await auth.recordPasswordSession(projectUrl,signedInUser,globalThis.fixtureClient);
const memberAdmin=await auth.getAppUser();
check(memberAdmin.isModerator&&memberAdmin.provider==='E-Mail','A fresh verified password session receives its assigned admin role');
check(JSON.stringify(memberAdmin.ownerKeys)===JSON.stringify(ownershipBefore)&&!auth.ownsVisit(memberAdmin,accountId(ids.other)),'Admin promotion preserves private ownership keys and does not grant another account’s visit ownership');
response=await update(ids.member,{role:'admin'});body=await response.json();
check(response.ok&&(await auth.getAppUser())?.isModerator,'An unchanged admin role is an idempotent update that keeps the new session active');
check(body.roleChanged===false,'An unchanged admin role reports no change or session revocation');
globalThis.fixtureAdmin=memberAdmin;
response=await update(ids.other,{role:'admin'});body=await response.json();
check(response.ok&&body.user.role==='admin'&&accountRole(ids.other)==='admin','A delegated administrator can assign another administrator');
check(db.prepare('SELECT assigned_by FROM auth_account_roles WHERE account_id=?').get(accountId(ids.other)).assigned_by===memberAdmin.userId,'Delegated assignments record the delegated administrator');
check(calls.filter(call=>['updateUserById','createUser','deleteUser'].includes(call.method)).length===providerWritesBeforeRole,'Role assignment never writes mutable provider metadata');

const nativeFetch=globalThis.fetch;
signedInUser={...users.get(ids.other),identities:[{provider:'google',identity_data:{sub:'fixture-other-google',email:'other@example.test',email_verified:true}}]};
sessionId='roles-google-admin';method='oauth';
globalThis.fetch=async url=>{assert.equal(String(url),'https://openidconnect.googleapis.com/v1/userinfo','Role fixtures never send live requests');return Response.json({sub:'fixture-other-google',email:signedInUser.email,email_verified:true});};
try{await auth.recordGoogleSession(projectUrl,{user:signedInUser,provider_token:'fixture-google-proof',access_token:'fixture-access',refresh_token:'fixture-refresh'},globalThis.fixtureClient);}
finally{globalThis.fetch=nativeFetch;}
const otherAdmin=await auth.getAppUser();
check(otherAdmin.isModerator&&otherAdmin.provider==='Google'&&otherAdmin.ownerKeys.length===1,'A fresh independently verified Google session receives its assigned admin role');
globalThis.fixtureAdmin=moderator;
response=await update(ids.member,{role:'user'});body=await response.json();
check(response.ok&&body.user.role==='user'&&accountRole(ids.member)==='user'&&noActiveSessions(ids.member),'An administrator can remove another administrator role and revoke all of its sessions');
check(body.roleChanged===true,'An actual demotion reports that the role changed');
signedInUser={...users.get(ids.member),user_metadata:{...users.get(ids.member).user_metadata,role:'admin'},app_metadata:{role:'admin'}};method='password';sessionId='roles-password-admin';
check(await auth.getAppUser()===null,'Demotion immediately denies a previously authenticated admin session');
sessionId='roles-password-demoted';await auth.recordPasswordSession(projectUrl,signedInUser,globalThis.fixtureClient);
const demotedUser=await auth.getAppUser();
check(!demotedUser.isModerator&&JSON.stringify(demotedUser.ownerKeys)===JSON.stringify(ownershipBefore),'After demotion a new login has ordinary rights with unchanged legacy ownership');
response=await update(ids.member,{role:'user'});body=await response.json();
check(response.ok&&(await auth.getAppUser())?.userId===demotedUser.userId,'An unchanged ordinary role preserves the current customer session');
check(body.roleChanged===false,'An unchanged ordinary role reports no change or session revocation');

enroll(ids.failure);globalThis.fixtureAdmin=memberAdmin;
response=await update(ids.failure,{role:'admin'});
check(!response.ok&&accountRole(ids.failure)==='user'&&sessionRevoked(ids.failure)===0,'A stale authenticated actor whose admin role was removed cannot grant a role or revoke target sessions');
globalThis.fixtureAdmin=moderator;
beforeBatch=()=>{beforeBatch=null;db.prepare('DELETE FROM auth_account_roles WHERE account_id=?').run(moderator.userId);};
response=await update(ids.failure,{role:'admin'});
check(!response.ok&&accountRole(ids.failure)==='user'&&sessionRevoked(ids.failure)===0,'Demotion between request authorization and the atomic role commit prevents a new grant');
seedAdmin(ids.current);
db.prepare('INSERT INTO auth_account_status (account_id,status,updated_at) VALUES (?,?,?)').run(moderator.userId,'inactive','2026-10-04');
response=await update(ids.failure,{role:'admin'});
check(!response.ok&&accountRole(ids.failure)==='user','A blocked admin actor cannot grant roles despite a stored role and stale authorized user');
db.prepare('DELETE FROM auth_account_status WHERE account_id=?').run(moderator.userId);
beforeRun=sql=>{if(/UPDATE auth_sessions SET revoked=1/i.test(sql)){beforeRun=null;throw Error('Fixture role revocation unavailable');}};
response=await update(ids.failure,{role:'admin'});
check(!response.ok&&accountRole(ids.failure)==='user'&&sessionRevoked(ids.failure)===0,'A failed session-revocation statement rolls back the preceding role grant');
beforeRun=null;

// Both requests hold a valid pre-change actor snapshot. Commit-time checks must
// serialize the decisions so one delegated administrator retains authority.
globalThis.fixtureAdmin=moderator;const demoteOther=update(ids.other,{role:'user'});
globalThis.fixtureAdmin=otherAdmin;const demoteCurrent=update(ids.current,{role:'user'});
const simultaneous=await Promise.all([demoteOther,demoteCurrent]);
check(simultaneous.filter(result=>result.ok).length===1&&[ids.current,ids.other].filter(id=>accountRole(id)==='admin').length===1,'Concurrent mutual demotion cannot remove both delegated administrators');
globalThis.fixtureAdmin=moderator;seedAdmin(ids.current);seedAdmin(ids.other);seedAdmin(ids.member);

const memberSession=enroll(ids.member);
response=await update(ids.member.toUpperCase(),{active:false});body=await response.json();
check(response.ok&&!body.user.active&&status(ids.member)==='inactive'&&sessionRevoked(ids.member)===1,'Deactivation immediately blocks the account and revokes existing app sessions');
check(!db.prepare('SELECT account_id FROM auth_account_status WHERE account_id=?').get(accountId(ids.member.toUpperCase())),'Uppercase route IDs cannot create a separate local block identity');
// A stale provider session may still appear unbanned; the local block must suffice.
signedInUser={...users.get(ids.member),banned_until:null};sessionId=memberSession;method='password';
check(await auth.getAppUser()===null,'Deactivated account is denied even with a valid provider identity');
sessionId='disabled-password-session';
await assert.rejects(auth.recordPasswordSession(projectUrl,signedInUser,globalThis.fixtureClient));passed++;
check(!db.prepare('SELECT id FROM auth_sessions WHERE id=?').get(sessionId),'Password sign-in cannot enroll a deactivated account');
method='oauth';sessionId='disabled-google-session';
await assert.rejects(auth.recordGoogleSession(projectUrl,{user:signedInUser,provider_token:'fixture-token'},globalThis.fixtureClient));passed++;
check(!db.prepare('SELECT id FROM auth_sessions WHERE id=?').get(sessionId),'Google sign-in cannot enroll a deactivated account');
method='password';
globalThis.fixtureNative={userId:'legacy-member',email:signedInUser.email,displayName:'Legacy Member',fullName:null};
db.prepare("UPDATE auth_settings SET enabled=0 WHERE id='main'").run();
check(await auth.getAppUser()===null,'Native legacy fallback cannot bypass a linked deactivation');
db.prepare("UPDATE auth_settings SET enabled=1 WHERE id='main'").run();globalThis.fixtureNative=null;

providerError={status:503,message:'Fixture provider unavailable'};
response=await update(ids.member,{active:true});
check(!response.ok&&status(ids.member)==='inactive'&&sessionRevoked(ids.member)===1,'Failed provider activation retains the local access block and revoked sessions');
providerError=null;
response=await update(ids.member,{active:true});body=await response.json();
check(response.ok&&body.user.active&&!status(ids.member),'Successful provider activation clears the local access block');
sessionId='reactivated-password-session';
await auth.recordPasswordSession(projectUrl,signedInUser,globalThis.fixtureClient);
check((await auth.getAppUser()).userId===accountId(ids.member),'Reactivated account can sign in with a new app session');
check(sessionRevoked(ids.member)===1,'Activation does not revive earlier sessions');

const deletionSession=enroll(ids.member);
visit('member-provider-visit',accountId(ids.member));visit('member-legacy-visit','legacy-member');visit('other-visit',accountId(ids.other));
response=await remove(ids.member.toUpperCase());body=await response.json();
check(response.ok&&body.ok&&!users.has(ids.member),'Account deletion removes the provider account');
check(status(ids.member)==='deleted'&&noActiveSessions(ids.member),'Deletion retains a tombstone and removes all usable app sessions');
check(!db.prepare('SELECT legacy_owner FROM auth_links WHERE account_id=?').get(accountId(ids.member)),'Deletion removes the provider ownership link');
check(accountRole(ids.member)==='user','Account deletion removes its delegated admin role');
check(db.prepare('SELECT COUNT(*) AS n FROM visits WHERE owner IN (?,?)').get(accountId(ids.member),'legacy-member').n===0,'Deletion removes provider and linked legacy visits');
check(objects.size===2&&[...objects.keys()].every(key=>key.includes(accountId(ids.other))),'Deletion removes all owned evidence versions and preserves another owner’s files');
check(db.prepare('SELECT status FROM auth_account_status WHERE account_id=?').get('legacy-member')?.status==='deleted','Deletion preserves the legacy-owner tombstone after removing its link');
sessionId=deletionSession;
check(await auth.getAppUser()===null,'Deleted account remains blocked with an old provider cookie');
sessionId='deleted-password-session';
await assert.rejects(auth.recordPasswordSession(projectUrl,signedInUser,globalThis.fixtureClient));passed++;
globalThis.fixtureNative={userId:'legacy-member',email:signedInUser.email,displayName:'Legacy Member',fullName:null};
db.prepare("UPDATE auth_settings SET enabled=0 WHERE id='main'").run();
check(await auth.getAppUser()===null,'Deleted native owner cannot return through legacy fallback');
db.prepare("UPDATE auth_settings SET enabled=1 WHERE id='main'").run();globalThis.fixtureNative=null;

enroll(ids.failure);providerError={status:503,message:'Fixture provider unavailable'};
response=await update(ids.failure,{active:false});
check(!response.ok&&status(ids.failure)==='inactive'&&sessionRevoked(ids.failure)===1,'Provider deactivation failure still denies local app access');
response=await remove(ids.failure);
check(!response.ok&&status(ids.failure)==='deleted'&&noActiveSessions(ids.failure),'Provider deletion failure still denies local app access');
providerError=null;
check((await update(ids.failure,{active:true})).status===409&&status(ids.failure)==='deleted','A deletion in progress cannot be undone by activation');
check((await update(ids.failure,{role:'admin'})).status===409&&accountRole(ids.failure)==='user','A deletion in progress cannot receive an admin role');
enroll(ids.other);visit('failed-cleanup-visit',accountId(ids.other));failBucket=true;
response=await remove(ids.other);
check(!response.ok&&status(ids.other)==='deleted'&&sessionRevoked(ids.other)===1,'Evidence cleanup failure cannot leave a deleted account authorized');
check(db.prepare('SELECT id FROM visits WHERE id=?').get('failed-cleanup-visit'),'Evidence cleanup failure retains the visit inventory for a safe retry');
failBucket=false;
response=await remove(ids.other);
check(response.ok&&!db.prepare('SELECT id FROM visits WHERE id=?').get('failed-cleanup-visit'),'Account deletion can retry evidence cleanup after a storage failure');

providerError={status:503,message:'Fixture provider unavailable'};
check((await list()).status===503,'Provider list failure is reported without a pretend successful listing');
providerError=null;globalThis.fixtureAuthAdmin=null;
response=await list();body=await response.json();
check(body.configured===false,'Missing server-side administration is visibly unconfigured');
check(!(await create({name:'New',email:'another@example.test',password:'fixture-password-123',active:true})).ok,'Missing admin credentials cannot create accounts');
globalThis.fixtureAuthAdmin={client:{auth:{admin:authAdmin}},projectUrl};
failDatabase=true;
let failedClosed=false;try{failedClosed=await auth.getAppUser()===null;}catch{failedClosed=true;}
check(failedClosed,'Account-status storage failures deny authentication');
failDatabase=false;
signedInUser=users.get(ids.current);method='password';sessionId='raced-password-session';
beforeRun=(sql)=>{if(/INSERT INTO auth_sessions/i.test(sql)){beforeRun=null;db.prepare('INSERT INTO auth_account_status (account_id,status,updated_at) VALUES (?,?,?)').run(accountId(ids.current),'inactive','2026-10-04');}};
await assert.rejects(auth.recordPasswordSession(projectUrl,signedInUser,globalThis.fixtureClient));passed++;
check(!db.prepare('SELECT id FROM auth_sessions WHERE id=?').get(sessionId),'A deactivation between verification and enrollment cannot create a new authorized session');
beforeRun=null;db.prepare('DELETE FROM auth_account_status WHERE account_id=?').run(accountId(ids.current));

globalThis.fixtureVisitor=moderator;
const evidenceRequest=(id,method,revision)=>{
 const form=new FormData();
 for(const [key,value] of Object.entries({id,workshop:'fixture-workshop',date:new Date().toISOString().slice(0,10),vehicle:'Fixture Car',service:'Inspektion & Wartung',evidenceType:'Rechnung',name:'Fixture Driver',review:'A sufficiently detailed fixture review of a documented workshop visit.',rating:'5',consent:'true',...(revision!==undefined?{revision:String(revision)}:{})}))form.set(key,value);
 form.set('file',new File(['%PDF-fixture document'],'fixture.pdf',{type:'application/pdf'}));
 return new Request(origin+'/api/visits',{method,headers:{Origin:origin},body:form});
};
const racedVisit='f0000000-0000-4000-8000-000000000001';
beforeRun=(sql)=>{if(/INSERT INTO visits/i.test(sql)){beforeRun=null;db.prepare('INSERT INTO auth_account_status (account_id,status,updated_at) VALUES (?,?,?)').run(accountId(ids.current),'deleted','2026-10-04');}};
response=await visits.POST(evidenceRequest(racedVisit,'POST'));
check(!response.ok&&!db.prepare('SELECT id FROM visits WHERE id=?').get(racedVisit),'An already authenticated submission cannot create a visit after account deletion begins');
check(![...objects.keys()].some(key=>key.includes(racedVisit)),'A rejected submission removes its newly uploaded evidence');
beforeRun=null;db.prepare('DELETE FROM auth_account_status WHERE account_id=?').run(accountId(ids.current));
const racedEdit='f0000000-0000-4000-8000-000000000002';visit(racedEdit,accountId(ids.current));
beforeRun=(sql)=>{if(/UPDATE visits SET workshop=/i.test(sql)){beforeRun=null;db.prepare('INSERT INTO auth_account_status (account_id,status,updated_at) VALUES (?,?,?)').run(accountId(ids.current),'inactive','2026-10-04');}};
response=await visits.PUT(evidenceRequest(racedEdit,'PUT',0));
check(!response.ok&&db.prepare('SELECT revision FROM visits WHERE id=?').get(racedEdit).revision===0,'An already authenticated edit cannot update a visit after deactivation begins');
check([...objects.keys()].filter(key=>key.includes(racedEdit)).length===2,'A rejected edit removes its new upload and preserves the previously owned evidence');
beforeRun=null;db.prepare('DELETE FROM auth_account_status WHERE account_id=?').run(accountId(ids.current));

// An uncertain final database commit must be recoverable after provider deletion.
globalThis.fixtureAdmin=moderator;enroll(ids.failure);
db.prepare("INSERT OR IGNORE INTO auth_links (account_id,legacy_owner,created_at) VALUES (?,'legacy-failure','2026-10-04')").run(accountId(ids.failure));
const normalProviderDelete=authAdmin.deleteUser;
authAdmin.deleteUser=async function(id){const result=await normalProviderDelete.call(this,id);beforeBatch=()=>{beforeBatch=null;throw Error('Fixture final account cleanup failure');};return result;};
response=await remove(ids.failure);
check(response.status===503&&!users.has(ids.failure)&&status(ids.failure)==='deleted','Provider deletion followed by local finalization failure leaves a blocked recovery state');
authAdmin.deleteUser=normalProviderDelete;
body=await list().then(response=>response.json());
check(body.pendingDeletions.some(user=>user.id===ids.failure),'Administrative recovery lists locally incomplete deletions even if the provider account disappeared');
check((await remove(ids.failure)).ok,'Administrative deletion retries a persisted tombstone after provider user_not_found');
check(!db.prepare('SELECT account_id FROM auth_links WHERE account_id=?').get(accountId(ids.failure))&&!db.prepare('SELECT id FROM auth_sessions WHERE account_id=?').get(accountId(ids.failure)),'Administrative recovery clears retained links and sessions');
check(!(await list().then(response=>response.json())).pendingDeletions.some(user=>user.id===ids.failure),'Completed cleanup disappears from administrative recovery');

// Exercise the privileged client boundary without sending any SDK network requests.
const clientConfigurations=[];
globalThis.fixtureCreateClient=(...args)=>{clientConfigurations.push(args);return {fixture:true};};
check(await adminProvider.getAuthAdmin()===null,'No privileged client is created without a server secret');
globalThis.fixtureEnv.SUPABASE_SECRET_KEY='sb_publishable_fixture_public_key_1234567890';
check(await adminProvider.getAuthAdmin()===null,'A public publishable key cannot authorize user administration');
globalThis.fixtureEnv.SUPABASE_SECRET_KEY='sb_secret_fixture_server_secret';
const privileged=await adminProvider.getAuthAdmin();
check(privileged.projectUrl===projectUrl&&clientConfigurations.length===1&&clientConfigurations[0][1]===globalThis.fixtureEnv.SUPABASE_SECRET_KEY,'The privileged client uses only the server secret for the configured project');
const options=clientConfigurations[0][2];
check(options.auth.persistSession===false&&options.auth.autoRefreshToken===false&&options.auth.detectSessionInUrl===false,'The privileged client does not persist or refresh browser sessions');
const jwt=role=>'fixture.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.fixture';
globalThis.fixtureEnv.SUPABASE_SECRET_KEY=jwt('anon');
check(await adminProvider.getAuthAdmin()===null,'A legacy anonymous JWT cannot authorize administration');
globalThis.fixtureEnv.SUPABASE_SECRET_KEY=jwt('service_role');
check((await adminProvider.getAuthAdmin())?.projectUrl===projectUrl,'A server-side legacy service-role credential supports administration');
console.log(JSON.stringify({userManagementChecksPassed:passed,realEmailsSent:false,liveProviderTested:false}));
