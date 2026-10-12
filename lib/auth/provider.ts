import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import type {AuthConfig} from './config';
import type {AuthClient,AuthAdminClient,AuthCookies} from './contract';
import {trustedAuthOrigin,authSecretMatchesOrigin,providerFetch,hostedAuthOrigin} from './origin';
import {authRequestState} from './request-context';

export function createAuthClient(config:AuthConfig,cookies:AuthCookies,secure:boolean):AuthClient{
 const origin=trustedAuthOrigin(config.projectUrl);
 const state=authRequestState(),transport=providerFetch(origin);
 const unavailable=()=>Response.json({msg:'Authentication provider unavailable',error_code:'auth_provider_unavailable'},{status:499});
 const serverFetch:typeof fetch=async(input,init)=>{
  if(state.failed)return unavailable();
  state.deadline??=Date.now()+1500;
  const remaining=state.deadline-Date.now();
  if(remaining<=0){state.failed=true;return unavailable();}
  try{
   const signal=AbortSignal.timeout(remaining);
   const response=await transport(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,signal]):signal});
   if(response.status>=500){state.failed=true;await response.body?.cancel();return unavailable();}
   if(!response.body)return response;
   // Include body reads in the deadline. A stalled or malformed refresh body
   // would otherwise become another retryable SDK error outside this adapter.
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024)throw Error('Auth response too large');chunks.push(value);}}
   catch(error){await reader.cancel().catch(()=>{});throw error;}
   finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   JSON.parse(new TextDecoder().decode(bytes));
   return new Response(bytes,{status:response.status,headers:response.headers});
  }catch{state.failed=true;return unavailable();}
 };
 const client=createServerClient(origin,config.publicKey,{
  // Hosted cookie names remain compatible. Custom instances include the complete
  // origin: SDK defaults only use the first hostname label and collide on ports.
  cookieOptions:{...(!hostedAuthOrigin(origin)?{name:'riparim-auth-'+encodeURIComponent(origin)}:{}),httpOnly:true,secure,sameSite:'lax',path:'/'},
  cookies:{getAll:()=>cookies.getAll(),setAll:values=>{if(!state.failed)cookies.setAll(values);}},
  // auth-js retries network/5xx refresh failures for 25.4 seconds. This local
  // non-retryable transport response is never sent to the browser. Suppressing
  // cookie writes on outage keeps even expired refresh credentials recoverable.
  global:{fetch:serverFetch}
 });
 // Explicit sign-in/account operations start a new auth phase. Database/file
 // work between verification and a mutation must not consume its time budget.
 return {auth:new Proxy(client.auth,{get(target,key){
  const value=Reflect.get(target,key);if(typeof value!=='function')return value;
  return (...args:unknown[])=>{if(key!=='getUser'&&key!=='getClaims'){state.failed=false;state.deadline=undefined;}return Reflect.apply(value,target,args);};
 }})};
}
export function createPasswordClient(config:AuthConfig):AuthClient{
 const origin=trustedAuthOrigin(config.projectUrl);
 const client=createClient(origin,config.publicKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:providerFetch(origin)}
 });
 return {auth:client.auth};
}
export function createAuthAdminClient(projectUrl:string,key:string):AuthAdminClient{
 const origin=trustedAuthOrigin(projectUrl);
 if(!authSecretMatchesOrigin(origin))throw Error('AUTH_SECRET_ORIGIN_MISMATCH');
 const client=createClient(origin,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:providerFetch(origin)}
 });
 return {auth:{admin:client.auth.admin}};
}
