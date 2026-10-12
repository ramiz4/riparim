import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';

const output='.test-runtime/auth-request-latency';
await mkdir(output,{recursive:true});
await build({stdin:{contents:`export {proxy} from './proxy';export {GET as session} from './app/api/session/route';export {withAuthRequest} from './lib/auth/request-context';export {createAuthClient} from './lib/auth/provider';`,resolveDir:process.cwd(),loader:'ts'},outfile:output+'/routes.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'request-fixtures',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/server|@\/app\/chatgpt-auth|\.\/chatgpt-auth|@\/db\/directory)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='cloudflare:workers'?`export const env=globalThis.fixtureEnv;`:args.path==='next/headers'?`export async function cookies(){return globalThis.fixtureCookies;}export async function headers(){return new Headers({host:'riparim.example.test'});}`:args.path==='next/server'?`function response(headers={},status){const result=new Response(null,{headers,status});result.cookies={set(){}};return result;}export const NextResponse={next:init=>response({},init?.status),rewrite:(url,init)=>response({'x-middleware-rewrite':String(url)},init?.status),redirect:(url,status)=>response({location:String(url)},status)};`:args.path==='@/db/directory'?`export async function publishedWorkshop(){return null;}`:`export async function getChatGPTUser(){return null;}`}));
}}]});

const origin='https://fixture-project.supabase.co';
const config={id:'main',project_url:origin,public_key:'sb_publishable_fixture_public_key_1234567890',enabled:1,email_delivery_confirmed:1,updated_at:'2026-10-11'};
globalThis.fixtureEnv={DB:{prepare(sql){assert.equal(sql,"SELECT * FROM auth_settings WHERE id='main'");return {first:async()=>config};}},BUCKET:{}};
const cookieMap=new Map();
globalThis.fixtureCookies={getAll:()=>[...cookieMap].map(([name,value])=>({name,value})),set(name,value,options){if(options?.maxAge===0)cookieMap.delete(name);else cookieMap.set(name,value);}};
const {proxy,session,withAuthRequest,createAuthClient}=await import(new URL('../'+output+'/routes.mjs',import.meta.url));
const originalFetch=globalThis.fetch,originalNow=Date.now,originalTimer=globalThis.setTimeout;
const originalConsoleError=console.error;
console.error=(...args)=>{if(args[0]?.code!=='auth_provider_unavailable')originalConsoleError(...args);};
process.on('exit',()=>{console.error=originalConsoleError;});
let elapsed=0,calls=0;
const started=originalNow();
Date.now=()=>started+elapsed;
globalThis.setTimeout=(callback,delay,...args)=>{if(delay>=200&&delay<=12800){elapsed+=delay;return originalTimer(callback,0,...args);}return originalTimer(callback,delay,...args);};
globalThis.fetch=async(input)=>{const url=new URL(String(input));assert.equal(url.origin,origin,'No live provider calls');calls++;throw new TypeError('Fixture provider network unavailable');};
try{
 const fixtureSession={access_token:'fixture.access.token',refresh_token:'fixture-refresh',expires_at:Math.floor(started/1000)+60,token_type:'bearer',user:{id:'fixture-user',email:'fixture@example.test'}};
 cookieMap.set('sb-fixture-project-auth-token','base64-'+Buffer.from(JSON.stringify(fixtureSession)).toString('base64url'));
 const originalCookie=cookieMap.get('sb-fixture-project-auth-token');
 const response=await withAuthRequest(async()=>{
  await proxy({url:'https://riparim.example.test/api/session',cookies:fixtureCookies});
  return session();
 });
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{account:null,isAdmin:false},'Provider outage cannot grant access');
 console.log(JSON.stringify({logicalWaitMs:elapsed,providerCalls:calls,liveRequests:false}));
 assert(elapsed<1000,'A session request must not wait through repeated SDK refresh backoffs');
 assert.equal(calls,1,'Proxy and route share one failure; no serial retry');
 assert.equal(cookieMap.get('sb-fixture-project-auth-token'),originalCookie,'An outage preserves refresh credentials');
}finally{globalThis.fetch=originalFetch;Date.now=originalNow;globalThis.setTimeout=originalTimer;}

const sdkConfig={projectUrl:origin,publicKey:config.public_key,enabled:true,emailDeliveryConfirmed:true,updatedAt:config.updated_at};
const runOutage=async(mode)=>{
 const keepAlive=originalTimer(()=>{},2500);
 let requests=0;
 const expired={access_token:'fixture.access.token',refresh_token:'fixture-refresh',expires_at:1,token_type:'bearer',user:{id:'fixture-user'}};
 const cookies=new Map([['sb-fixture-project-auth-token','base64-'+Buffer.from(JSON.stringify(expired)).toString('base64url')]]);
 const cookieApi={getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value,options})=>{if(options.maxAge===0)cookies.delete(name);else cookies.set(name,value);})};
 const before=[...cookies],begin=performance.now();
 globalThis.fetch=async(input,init)=>{
  assert.equal(new URL(String(input)).origin,origin);requests++;
  if(mode==='network')throw Error('Fixture outage');
  if(mode==='http')return Response.json({msg:'Fixture outage'},{status:503});
  if(mode==='malformed')return new Response('not JSON');
  if(mode==='oversized')return new Response('x'.repeat(1024*1024+1));
  if(mode==='headers')return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
  return new Response(new ReadableStream({start(controller){init.signal.addEventListener('abort',()=>controller.error(init.signal.reason),{once:true});}}));
 };
 try{
  await withAuthRequest(async()=>{
   const first=await createAuthClient(sdkConfig,cookieApi,true).auth.getUser();assert.equal(first.data.user,null);
   const second=await createAuthClient(sdkConfig,cookieApi,true).auth.getUser();assert.equal(second.data.user,null);
  });
  assert.equal(requests,1,mode+': one provider attempt across clients');
  assert.deepEqual([...cookies],before,mode+': transport outage never clears expired credentials');
  assert(performance.now()-begin<2000,mode+': bounded request deadline includes response body');
  console.log(JSON.stringify({mode,elapsedMs:Math.round(performance.now()-begin),providerCalls:requests,credentialsPreserved:true}));
 }finally{clearTimeout(keepAlive);globalThis.fetch=originalFetch;}
};
for(const mode of ['network','http','malformed','oversized','headers','body'])await runOutage(mode);

// Outage flags and deadlines belong to one request, even when another overlaps.
globalThis.fetch=async(input,init)=>{assert.equal(new URL(String(input)).origin,origin);if(new Headers(init.headers).get('authorization')==='Bearer fixture.bad.token')throw Error('Fixture isolated outage');return Response.json({id:'fixture-user',email:'fixture@example.test',email_confirmed_at:'2026-10-11',app_metadata:{provider:'email'},user_metadata:{}});};
try{
 const valid={access_token:'fixture.access.token',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:'fixture-user'}};
 const cookieApi={getAll:()=>[{name:'sb-fixture-project-auth-token',value:'base64-'+Buffer.from(JSON.stringify(valid)).toString('base64url')}],setAll(){}};
 const isolated=await Promise.all([
  withAuthRequest(async()=>{const badCookies={getAll:()=>[{name:'sb-fixture-project-auth-token',value:'base64-'+Buffer.from(JSON.stringify({...valid,access_token:'fixture.bad.token'})).toString('base64url')}],setAll(){}};const bad=createAuthClient(sdkConfig,badCookies,true);assert.equal((await bad.auth.getUser()).data.user,null);}),
  withAuthRequest(async()=>assert.equal((await createAuthClient(sdkConfig,cookieApi,true).auth.getUser()).data.user.id,'fixture-user'))
 ]);
 assert.equal(isolated.length,2);
 assert.equal((await withAuthRequest(()=>createAuthClient(sdkConfig,cookieApi,true).auth.getUser())).data.user.id,'fixture-user','A new request can recover after an outage');
 await withAuthRequest(async()=>{
  const client=createAuthClient(sdkConfig,cookieApi,true);
  assert.equal((await client.auth.getUser()).data.user.id,'fixture-user');
  const originalClock=Date.now;Date.now=()=>originalClock()+2000;
  try{assert.equal((await client.auth.updateUser({password:'fixture-new-password'})).data.user.id,'fixture-user','An explicit mutation has its own auth phase after slow local work');}
  finally{Date.now=originalClock;}
 });
}finally{globalThis.fetch=originalFetch;}

// A definitive rejection still invalidates genuinely expired credentials.
globalThis.fetch=async()=>Response.json({msg:'Fixture rejected refresh token',error_code:'refresh_token_not_found'},{status:400});
try{
 const cookies=new Map([['sb-fixture-project-auth-token','base64-'+Buffer.from(JSON.stringify({access_token:'fixture.access.token',refresh_token:'fixture-rejected',expires_at:1,token_type:'bearer',user:{id:'fixture-user'}})).toString('base64url')]]);
 const cookieApi={getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value,options})=>{if(options.maxAge===0)cookies.delete(name);else cookies.set(name,value);})};
 assert.equal((await withAuthRequest(()=>createAuthClient(sdkConfig,cookieApi,true).auth.getUser())).data.user,null);
 assert.equal(cookies.size,0,'Definitive provider rejection retains the SDK invalidation behavior');
}finally{globalThis.fetch=originalFetch;console.error=originalConsoleError;}
