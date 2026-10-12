import {authUser,authClient as neutralClient} from './helpers/auth-contract.mjs';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
import {DatabaseSync} from 'node:sqlite';
const root=process.cwd();
const bundle=await build({entryPoints:['app/auth.ts','lib/auth/config.ts','lib/auth/identities.ts'],bundle:true,format:'esm',platform:'node',outdir:'.test-runtime/auth-ownership',write:false,plugins:[{name:'test-boundaries',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|@\/app\/chatgpt-auth|\.\/chatgpt-auth|@\/lib\/auth\/client)$/},args=>({path:args.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:args.path==='cloudflare:workers'?'export const env=globalThis.fixtureEnv;':args.path.includes('chatgpt-auth')?'export async function getChatGPTUser(){return globalThis.fixtureNative;}':'export async function authClient(){return globalThis.fixtureClient;}',loader:'js'}));
}}]});
await mkdir('.test-runtime/auth-ownership',{recursive:true});
for(const file of bundle.outputFiles){await mkdir(file.path.slice(0,file.path.lastIndexOf('/')),{recursive:true});await writeFile(file.path.replace(/\.js$/,'.mjs'),file.contents);}
const db=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
const d1={prepare(sql){
 const s=db.prepare(sql);
 const adapter=(values=[])=>({
  first:async()=>s.get(...values)??null,
  run:async()=>({meta:s.run(...values)}),
  all:async()=>({results:s.all(...values)}),
  bind:(...next)=>adapter(next)
 });
 return adapter();
}};
globalThis.fixtureEnv={DB:d1,BUCKET:{},REVIEW_MODERATOR_EMAIL:'owner@example.test',SITE_ORIGIN:'https://mjeshter-kosovo.r-loki.chatgpt.site'};
globalThis.fixtureNative=null;
let user={id:'00000000-0000-4000-8000-000000000001',email:'owner@example.test',email_confirmed_at:'2026-10-02T12:00:00Z',user_metadata:{full_name:'Fixture Owner'}};
let error=null,claimsError=null,sessionId='fixture-session-1';
globalThis.fixtureClient=neutralClient({auth:{getUser:async()=>({data:{user},error}),getClaims:async()=>({data:{claims:{session_id:sessionId,sub:user.id,amr:[{method:"password"}]}},error:claimsError})}},'https://fixture-project.supabase.co');
const auth=await import(new URL('.test-runtime/auth-ownership/app/auth.mjs','file://'+root+'/').href);
const cfg=await import(new URL('.test-runtime/auth-ownership/lib/auth/config.mjs','file://'+root+'/').href);
const identities=await import(new URL('.test-runtime/auth-ownership/lib/auth/identities.mjs','file://'+root+'/').href);
let passed=0;
function check(value,label){assert(value,label);passed++;}
check((await auth.getAppUser())===null,'no unauthenticated legacy user');
globalThis.fixtureNative={userId:'native-owner',email:'owner@example.test',displayName:'Fixture Owner',fullName:null};
check((await auth.getAppUser()).userId==='native-owner','legacy stable owner');
db.prepare("INSERT INTO auth_settings (id,project_url,public_key,enabled,email_delivery_confirmed,updated_at) VALUES ('main',?,?,1,1,?)").run('https://fixture-project.supabase.co','sb_publishable_abcdefghijklmnopqrstuvwxyz012345','2026-10-02');
check(await auth.getAppUser()===null,'unregistered cookie session denied');
const accountId=`supabase:fixture-project.supabase.co:${user.id}`;
db.prepare("INSERT INTO auth_links (account_id,legacy_owner,owner_admin,created_at) VALUES (?,?,1,?)").run(accountId,'native-owner','2026-10-02');
db.prepare("INSERT INTO auth_sessions (id,account_id,revoked,legacy_access,expires_at,created_at) VALUES (?,?,0,0,?,?)").run(sessionId,accountId,Date.now()+86400000,'2026-10-02');
let active=await auth.getAppUser();
check(active.ownerKeys.length===1&&!active.isModerator,'pre-link session cannot inherit legacy access');
db.prepare('UPDATE auth_sessions SET legacy_access=1').run();
active=await auth.getAppUser();
check(active.ownerKeys.includes('native-owner')&&!active.isModerator,'authorized password linkage does not inherit Google moderation');
await auth.revokeCurrentSession(globalThis.fixtureClient);
check(await auth.getAppUser()===null,'revoked session denied despite valid provider identity');
db.prepare('UPDATE auth_sessions SET revoked=0').run();
user={...user,email_confirmed_at:null};check(await auth.getAppUser()===null,'unconfirmed email denied');
user={...user,email_confirmed_at:'2026-10-02'};error={code:'invalid_token'};check(await auth.getAppUser()===null,'invalid provider token denied');
error=null;claimsError={code:'invalid_signature'};check(await auth.getAppUser()===null,'invalid claims denied');claimsError=null;
user={...user,id:'00000000-0000-4000-8000-000000000002'};check(await auth.getAppUser()===null,'another identity cannot reuse session');
user={...user,id:'00000000-0000-4000-8000-000000000001'};
check(await identities.resolveSupabaseAccount('https://another-project.supabase.co',user.id)!==accountId,'project identities are scoped');
sessionId='fixture-password-session';
await auth.recordPasswordSession(authUser(user,'https://fixture-project.supabase.co'),globalThis.fixtureClient);
check((await auth.getAppUser()).ownerKeys.includes('native-owner'),'password login grants appropriate linkage');
check(cfg.safeReturnPath('https://evil.example')==='/?besuche=1','external return denied');
check(cfg.safeReturnPath('//evil.example')==='/?besuche=1','protocol-relative return denied');
check(cfg.safeReturnPath('/?besuche=1')==='/?besuche=1','local return allowed');
for(const [url,key] of [['http://localhost','sb_publishable_abcdefghijklmnopqrstuvwxyz012345'],['https://fixture-project.supabase.co','sb_secret_badsecret'],['https://supabase.co.evil.example','sb_publishable_abcdefghijklmnopqrstuvwxyz012345']]){
 let denied=false;try{cfg.validatePublicConfig(url,key);}catch{denied=true;}check(denied,'unsafe provider config denied');
}
check(cfg.validatePublicConfig('https://fixture-project.supabase.co','sb_publishable_abcdefghijklmnopqrstuvwxyz012345').projectUrl==='https://fixture-project.supabase.co','public config accepted');
console.log(JSON.stringify({authorizationChecksPassed:passed,realEmailsSent:false,liveProviderTested:false}));
