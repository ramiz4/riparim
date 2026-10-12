import {createServerClient} from '@supabase/ssr';
import {createClient,type User,type AuthError as ProviderError} from '@supabase/supabase-js';
import type {AuthConfig} from '../config';
import type {AuthClient,AuthAdminClient,AuthCookies,AuthUser,AuthUserAttributes,AuthError,SessionResult,AuthAvailability} from '../contract';
import {trustedAuthOrigin,providerFetch,hostedAuthOrigin} from '../origin';
import {authRequestState} from '../request-context';
import {supabaseIdentity} from '../legacy-supabase';

export function validateSupabaseKey(key:string){
 if(key.startsWith('sb_secret_')||key.length>1800)throw Error('INVALID_PUBLIC_KEY');
 if(!/^sb_publishable_[a-zA-Z0-9_-]{20,}$/.test(key)){
  try{if(JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role!=='anon')throw Error();}catch{throw Error('INVALID_PUBLIC_KEY');}
 }
}
export function validSupabaseSecret(key:string){
 if(key.startsWith('sb_secret_'))return true;
 try{return JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='service_role';}catch{return false;}
}
function normalize(user:User|null,origin:string):AuthUser|null{
 if(!user)return null;
 const identity=supabaseIdentity(origin,user.id.toLowerCase());
 if(user.email!==undefined&&typeof user.email!=='string')throw Error('INVALID_PROVIDER_USER');
 const metadata=user.user_metadata??{};
 return {identity,email:user.email,emailVerified:typeof user.email_confirmed_at==='string'&&Number.isFinite(Date.parse(user.email_confirmed_at)),name:typeof metadata.full_name==='string'?metadata.full_name:undefined,preferredLocale:typeof metadata.preferred_locale==='string'?metadata.preferred_locale:undefined,createdAt:user.created_at,lastSignInAt:user.last_sign_in_at,blocked:!!user.banned_until&&Date.parse(user.banned_until)>Date.now(),loginProviders:[...new Set(user.identities?.map(value=>value.provider)??[])],googleIdentities:(user.identities??[]).flatMap(value=>value.provider==='google'&&typeof value.identity_data?.sub==='string'&&typeof value.identity_data?.email==='string'?[{subject:value.identity_data.sub,email:value.identity_data.email,emailVerified:value.identity_data.email_verified===true}]:[])};
}
function error(value:ProviderError|null):AuthError|null{
 if(!value)return null;
 const code=value.code;
 return {status:value.status,code:code==='user_not_found'||value.status===404?'not_found':code==='email_exists'||code==='user_already_exists'?'email_exists':code==='weak_password'?'weak_password':value.status===429||code==='over_email_send_rate_limit'||code==='over_request_rate_limit'?'rate_limited':code==='email_address_not_authorized'?'email_unavailable':code==='invalid_credentials'?'invalid_credentials':'unavailable'};
}
function attributes(input:AuthUserAttributes){
 return {...(input.email!==undefined?{email:input.email}:{}),...(input.password!==undefined?{password:input.password}:{}),...(input.name!==undefined||input.preferredLocale!==undefined?{user_metadata:{...(input.name!==undefined?{full_name:input.name}:{}),...(input.preferredLocale!==undefined?{preferred_locale:input.preferredLocale}:{})}}:{}),...(input.emailVerified!==undefined?{email_confirm:input.emailVerified}:{}),...(input.active!==undefined?{ban_duration:input.active?'none':'876000h'}:{})};
}
export async function supabaseAvailability(config:Pick<AuthConfig,'projectUrl'|'publicKey'>):Promise<AuthAvailability>{
 const origin=trustedAuthOrigin(config.projectUrl,'supabase'),response=await providerFetch(origin)(`${origin}/auth/v1/settings`,{headers:{apikey:config.publicKey},cache:'no-store'});
 if(!response.ok)throw Error('PROVIDER_UNAVAILABLE');
 const value:unknown=await response.json();if(!value||typeof value!=='object')throw Error('INVALID_PROVIDER_SETTINGS');
 const settings=value as {external?:{email?:unknown;google?:unknown};mailer_autoconfirm?:unknown;disable_signup?:unknown};
 const email=settings.external?.email===true&&settings.mailer_autoconfirm===false;
 return {email,emailSignup:email&&settings.disable_signup!==true,emailRecovery:email,google:settings.external?.google===true};
}
export function supabaseClient(config:AuthConfig,cookies:AuthCookies|null,secure:boolean):AuthClient{
 const origin=trustedAuthOrigin(config.projectUrl,'supabase');
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
 const rawClient=cookies?createServerClient(origin,config.publicKey,{cookieOptions:{...(!hostedAuthOrigin(origin)?{name:'riparim-auth-'+encodeURIComponent(origin)}:{}),httpOnly:true,secure,sameSite:'lax',path:'/'},cookies:{getAll:()=>cookies.getAll(),setAll:values=>{if(!state.failed)cookies.setAll(values);}},global:{fetch:serverFetch}}):createClient(origin,config.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:providerFetch(origin)}});
 const client=cookies?{auth:new Proxy(rawClient.auth,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=='function')return value;return (...args:unknown[])=>{if(key!=='getUser'&&key!=='getClaims'){state.failed=false;state.deadline=undefined;}return Reflect.apply(value,target,args);};}})}:rawClient;
 const sessionResult=(data:{user:User|null;session:{user:User;provider_token?:string|null}|null},failure:ProviderError|null):SessionResult=>({data:{user:normalize(data.user,origin),session:data.session?{user:normalize(data.session.user,origin)!,googleAccessToken:data.session.provider_token}:null},error:error(failure)});
 return {
  async getUser(){const result=await client.auth.getUser();return {data:{user:normalize(result.data.user,origin)},error:error(result.error)};},
  async getSessionProof(){
   const result=await client.auth.getClaims(),claims=result.data?.claims;
   if(!result.error&&!claims)return {data:{proof:null},error:null};
   const methods=Array.isArray(claims?.amr)?claims.amr:[];
   const method=methods.some(value=>typeof value==='object'&&value!==null&&value.method==='oauth')?'google':methods.some(value=>typeof value==='object'&&value!==null&&value.method==='password')?'password':methods.some(value=>typeof value==='object'&&value!==null&&value.method==='recovery')?'recovery':'unknown';
   if(result.error||typeof claims?.sub!=='string'||typeof claims.session_id!=='string'||claims.iss!==origin+'/auth/v1')return {data:{proof:null},error:error(result.error)??{code:'invalid_response'}};
   return {data:{proof:{id:claims.session_id,subject:claims.sub,method}},error:null};
  },
  async signInWithPassword(credentials){const result=await client.auth.signInWithPassword(credentials);return sessionResult(result.data,result.error);},
  async signUp(credentials){const result=await client.auth.signUp({email:credentials.email,password:credentials.password,options:{data:{full_name:credentials.name,preferred_locale:credentials.preferredLocale},emailRedirectTo:credentials.redirectTo}});return sessionResult(result.data,result.error);},
  async beginGoogle(redirectTo){const result=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo,scopes:'openid email profile',skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
   if(result.data.url){const target=new URL(result.data.url);if(target.origin!==origin||target.pathname!=='/auth/v1/authorize')throw Error('INVALID_PROVIDER_REDIRECT');}return {data:{url:result.data.url},error:error(result.error)};},
  async completeGoogle(code){const result=await client.auth.exchangeCodeForSession(code),normalized=sessionResult(result.data,result.error);if(result.data.session&&!result.error){const saved=await client.auth.setSession({access_token:result.data.session.access_token,refresh_token:result.data.session.refresh_token});if(saved.error)return sessionResult({user:null,session:null},saved.error);}return normalized;},
  async confirmEmail(token,format='token'){const result=format==='code'?await client.auth.exchangeCodeForSession(token):await client.auth.verifyOtp({token_hash:token,type:'signup'});return {data:{confirmed:!!normalize(result.data.user,origin)?.emailVerified},error:error(result.error)};},
  async acceptRecovery(token,format='token'){const result=format==='code'?await client.auth.exchangeCodeForSession(token):await client.auth.verifyOtp({token_hash:token,type:'recovery'});return {data:{ready:!!normalize(result.data.user,origin)?.emailVerified},error:error(result.error)};},
  callbackReturn(){return null;},
  async recoveryReady(){const result=await client.auth.getUser();return !result.error&&!!normalize(result.data.user,origin)?.emailVerified;},
  async requestRecovery(email,redirectTo){return {error:error((await client.auth.resetPasswordForEmail(email,{redirectTo})).error)};},
  async resetPassword(password){state.failed=false;state.deadline=undefined;const current=await client.auth.getUser(),user=normalize(current.data.user,origin);if(current.error||!user?.emailVerified||user.blocked)return {data:{identity:null},error:error(current.error)??{code:'invalid_credentials'}};const result=await client.auth.updateUser({password});return {data:{identity:result.error?null:user.identity},error:error(result.error)};},
  async signOut(options){return {error:error((await client.auth.signOut(options)).error)};}
 };
}
export function supabaseAdmin(origin:string,key:string):AuthAdminClient{
 const client=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:providerFetch(origin)}}).auth.admin;
 function response(result:{data:{user:User|null};error:ProviderError|null},id?:string,optional=false){
  if(result.error)return {data:{user:null},error:error(result.error)};
  const user=normalize(result.data.user,origin);
  if(id!==undefined&&(user?user.identity.subject!==normalizeSupabaseSubject(id):!optional))return {data:{user:null},error:{code:'invalid_response' as const}};
  return {data:{user},error:null};
 }
 return {
  async listUsers(params){const result=await client.listUsers(params);return {data:{users:result.data.users.map(user=>normalize(user,origin)!),...('total'in result.data?{total:result.data.total}:{})},error:error(result.error)};},
  async getUserById(id){return response(await client.getUserById(id),id);},
  async createUser(input){return response(await client.createUser(attributes(input)));},
  async updateUserById(id,input){return response(await client.updateUserById(id,attributes(input)),id);},
  async deleteUser(id){return response(await client.deleteUser(id),id,true);}
 };
}

export function normalizeSupabaseSubject(id:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?id.toLowerCase():null;}
