import {createServerClient} from '@supabase/ssr';
import {createClient,type User,type AuthError as ProviderError} from '@supabase/supabase-js';
import type {AuthConfig} from '../config';
import type {AuthClient,AuthAdminClient,AuthCookies,AuthUser,AuthUserAttributes,AuthError,SessionResult,AuthAvailability} from '../contract';
import {trustedAuthOrigin,providerFetch,hostedAuthOrigin} from '../origin';
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
 const identity=supabaseIdentity(origin,user.id);
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
 const client=cookies?createServerClient(origin,config.publicKey,{cookieOptions:{...(!hostedAuthOrigin(origin)?{name:'riparim-auth-'+encodeURIComponent(origin)}:{}),httpOnly:true,secure,sameSite:'lax',path:'/'},cookies,global:{fetch:providerFetch(origin)}}):createClient(origin,config.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:providerFetch(origin)}});
 const sessionResult=(data:{user:User|null;session:{user:User;provider_token?:string|null}|null},failure:ProviderError|null):SessionResult=>({data:{user:normalize(data.user,origin),session:data.session?{user:normalize(data.session.user,origin)!,googleAccessToken:data.session.provider_token}:null},error:error(failure)});
 return {
  async getUser(){const result=await client.auth.getUser();return {data:{user:normalize(result.data.user,origin)},error:error(result.error)};},
  async getSessionProof(){
   const result=await client.auth.getClaims(),claims=result.data?.claims;
   const method=claims?.amr?.some(value=>typeof value==='object'&&value!==null&&value.method==='oauth')?'google':claims?.amr?.some(value=>typeof value==='object'&&value!==null&&value.method==='password')?'password':claims?.amr?.some(value=>typeof value==='object'&&value!==null&&value.method==='recovery')?'recovery':null;
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
  confirmationReturn(){return null;},
  async recoveryReady(){const result=await client.auth.getUser();return !result.error&&!!normalize(result.data.user,origin)?.emailVerified;},
  async requestRecovery(email,redirectTo){return {error:error((await client.auth.resetPasswordForEmail(email,{redirectTo})).error)};},
  async resetPassword(password){const current=await client.auth.getUser(),user=normalize(current.data.user,origin);if(current.error||!user?.emailVerified||user.blocked)return {data:{identity:null},error:error(current.error)??{code:'invalid_credentials'}};const result=await client.auth.updateUser({password});return {data:{identity:result.error?null:user.identity},error:error(result.error)};},
  async signOut(options){return {error:error((await client.auth.signOut(options)).error)};}
 };
}
export function supabaseAdmin(origin:string,key:string):AuthAdminClient{
 const client=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:providerFetch(origin)}}).auth.admin;
 return {
  async listUsers(params){const result=await client.listUsers(params);return {data:{users:result.data.users.map(user=>normalize(user,origin)!),...('total'in result.data?{total:result.data.total}:{})},error:error(result.error)};},
  async getUserById(id){const result=await client.getUserById(id);return {data:{user:normalize(result.data.user,origin)},error:error(result.error)};},
  async createUser(input){const result=await client.createUser(attributes(input));return {data:{user:normalize(result.data.user,origin)},error:error(result.error)};},
  async updateUserById(id,input){const result=await client.updateUserById(id,attributes(input));return {data:{user:normalize(result.data.user,origin)},error:error(result.error)};},
  async deleteUser(id){const result=await client.deleteUser(id);return {data:{user:normalize(result.data.user,origin)},error:error(result.error)};}
 };
}

export function normalizeSupabaseSubject(id:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?id.toLowerCase():null;}
