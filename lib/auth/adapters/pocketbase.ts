import type {AuthConfig} from '../config';
import type {AuthClient,AuthAdminClient,AuthCookies,AuthUser,AuthUserAttributes,AuthError,AuthMethod,AuthAvailability,AuthResult,SessionResult} from '../contract';
import {checkedIdentity} from '../identities';
import {trustedAuthOrigin,providerFetch} from '../origin';

const collection='/api/collections/users';
class ProviderFailure extends Error{constructor(public failure:AuthError){super(failure.code);}}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ProviderFailure({code:'invalid_response'});return value as Record<string,unknown>;}
function text(value:unknown,max=512){if(typeof value!=='string'||!value||value.length>max)throw new ProviderFailure({code:'invalid_response'});return value;}
function subject(value:unknown){const id=text(value,15);if(!/^[a-z0-9]{15}$/.test(id))throw new ProviderFailure({code:'invalid_response'});return id;}
function normalize(value:unknown,origin:string):AuthUser{
 const record=object(value);if(record.collectionName!=='users'||record.collectionId!=='_pb_users_auth_'||typeof record.verified!=='boolean')throw new ProviderFailure({code:'invalid_response'});
 return {identity:checkedIdentity({provider:'pocketbase',issuer:origin,subject:subject(record.id)}),email:text(record.email,254),emailVerified:record.verified,name:typeof record.name==='string'?record.name:undefined,preferredLocale:typeof record.preferredLocale==='string'?record.preferredLocale:undefined,createdAt:typeof record.created==='string'?record.created:undefined,blocked:false,loginProviders:['email'],googleIdentities:[]};
}
// Parsing is only a format check. This identity is returned to callers solely
// AFTER PocketBase has accepted the complete signed reset token.
function resetSubject(token:string){
 const parts=token.split('.');if(parts.length!==3||token.length>4096)throw new ProviderFailure({code:'invalid_response'});
 const payload=object(JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))));
 if(payload.type!=='passwordReset'||payload.collectionId!=='_pb_users_auth_'||typeof payload.exp!=='number'||payload.exp*1000<=Date.now())throw new ProviderFailure({code:'invalid_response'});
 return subject(payload.id);
}
function failure(value:unknown):AuthError{return value instanceof ProviderFailure?value.failure:{code:'unavailable'};}
async function attempt<T>(empty:T,operation:()=>Promise<T>):Promise<AuthResult<T>>{try{return {data:await operation(),error:null};}catch(e){return {data:empty,error:failure(e)};}}
function requestApi(origin:string,key?:string){
 const request=providerFetch(origin,8000,'pocketbase');
 return async(path:string,method='GET',body?:unknown,token=key)=>{
  const response=await request(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
  if(!response.ok){
   let data:Record<string,unknown>={};try{data=object(object(await response.json()).data);}catch{}
   const email=data.email&&object(data.email).code,password=data.password&&object(data.password).code;
   throw new ProviderFailure({status:response.status,code:response.status===404?'not_found':response.status===429?'rate_limited':email==='validation_not_unique'?'email_exists':typeof password==='string'&&password.startsWith('validation_')?'weak_password':response.status===400||response.status===401?'invalid_credentials':'unavailable'});
  }
  return response.status===204?null:await response.json();
 };
}
export async function pocketbaseAvailability(config:Pick<AuthConfig,'projectUrl'>):Promise<AuthAvailability>{
 const origin=trustedAuthOrigin(config.projectUrl,'pocketbase'),value=object(await requestApi(origin)(collection+'/auth-methods'));
 const password=object(value.password),oauth=object(value.oauth2),mfa=object(value.mfa);
 const email=password.enabled===true&&Array.isArray(password.identityFields)&&password.identityFields.includes('email')&&mfa.enabled===false;
 return {email,emailSignup:email,emailRecovery:email,google:mfa.enabled===false&&oauth.enabled===true&&Array.isArray(oauth.providers)&&oauth.providers.some(provider=>object(provider).name==='google')};
}
export function pocketbaseClient(config:AuthConfig,cookies:AuthCookies|null,secure:boolean):AuthClient{
 const origin=trustedAuthOrigin(config.projectUrl,'pocketbase'),api=requestApi(origin),prefix='riparim-pb-'+encodeURIComponent(origin),sessionCookie=prefix+'-session',flowCookie=prefix+'-google',recoveryCookie=prefix+'-recovery';
 const cookie=(name:string)=>cookies?.getAll().find(value=>value.name===name)?.value;
 const set=(name:string,value:string,maxAge:number)=>cookies?.setAll([{name,value,options:{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge}}]);
 let token='',nonce='',method:AuthMethod|null=null;
 try{const saved=object(JSON.parse(cookie(sessionCookie)??'null'));if(typeof saved.nonce==='string'&&/^[0-9a-f-]{36}$/.test(saved.nonce)){token=text(saved.token,4096);nonce=saved.nonce;}}catch{/* Invalid cookies never reach the provider. */}
 const verified=async()=>{
  if(!token)return null;
  const result=object(await api(collection+'/auth-refresh','POST',{},token));
  // Verify the old token remotely but retain it: auth-refresh generates a new
  // token; each browser login also has its own random private app nonce.
  text(result.token,4096);const user=normalize(result.record,origin);
  // _externalAuths is provider-managed; current PocketBase restricts this list
  // to the authenticated record. Editable profile fields are never OAuth proof.
  const links=object(await api('/api/collections/_externalAuths/records?perPage=100','GET',undefined,token));
  if(!Array.isArray(links.items)||!Number.isSafeInteger(links.totalItems)||Number(links.totalItems)>100)throw new ProviderFailure({code:'invalid_response'});
  user.googleIdentities=links.items.flatMap(value=>{const link=object(value);return link.provider==='google'&&link.recordRef===user.identity.subject&&link.collectionRef==='_pb_users_auth_'?[{subject:text(link.providerId),email:user.email!,emailVerified:user.emailVerified}]:[];});
  if(user.googleIdentities.length)user.loginProviders.push('google');return user;
 };
 const adopt=async(value:unknown,nextMethod:AuthMethod)=>{
  const result=object(value);token=text(result.token,4096);const user=normalize(result.record,origin),checked=await verified();
  if(!checked||checked.identity.subject!==user.identity.subject)throw new ProviderFailure({code:'invalid_response'});
  method=nextMethod;nonce=crypto.randomUUID();set(sessionCookie,JSON.stringify({token,nonce}),30*86400);return {user:checked,session:{user:checked}};
 };
 return {
  getUser:()=>attempt({user:null as AuthUser|null},async()=>({user:await verified()})),
  getSessionProof:()=>attempt({proof:null as {id:string;subject:string;method:AuthMethod|null}|null},async()=>{const user=await verified();if(!user)return {proof:null};const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce+':'+token));const hash=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');return {proof:{id:prefix+':'+hash,subject:user.identity.subject,method}};}),
  signInWithPassword:credentials=>attempt<SessionResult['data']>({user:null,session:null},async()=>adopt(await api(collection+'/auth-with-password','POST',{identity:credentials.email,password:credentials.password,identityField:'email'}),'password')),
  signUp:credentials=>attempt<SessionResult['data']>({user:null,session:null},async()=>{const user=normalize(await api(collection+'/records','POST',{email:credentials.email,password:credentials.password,passwordConfirm:credentials.password,name:credentials.name,preferredLocale:credentials.preferredLocale}),origin);if(user.emailVerified||user.name!==credentials.name||user.preferredLocale!==credentials.preferredLocale)throw new ProviderFailure({code:'invalid_response'});await api(collection+'/request-verification','POST',{email:credentials.email});set(prefix+'-email-signup',JSON.stringify({redirectTo:credentials.redirectTo,expiresAt:Date.now()+3600000}),3600);return {user,session:null};}),
  beginGoogle:redirectTo=>attempt({url:null as string|null},async()=>{
   const methods=object(await api(collection+'/auth-methods')),oauth=object(methods.oauth2);
   if(oauth.enabled!==true||!Array.isArray(oauth.providers))throw new ProviderFailure({code:'unavailable'});
   const google=object(oauth.providers.find(value=>object(value).name==='google'));
   const url=new URL(text(google.authURL,4096)),state=text(google.state),verifier=text(google.codeVerifier);
   if(url.origin!=='https://accounts.google.com'||!/^\/o\/oauth2\/(?:v2\/)?auth$/.test(url.pathname)||url.username||url.password||url.searchParams.get('state')!==state||url.searchParams.get('code_challenge_method')!=='S256'||google.codeChallengeMethod!=='S256'||url.searchParams.get('code_challenge')!==google.codeChallenge||url.searchParams.get('response_type')!=='code')throw new ProviderFailure({code:'invalid_response'});
   const callback=new URL(redirectTo);if(callback.protocol!=='https:'||callback.username||callback.password||callback.pathname!=='/auth/bestaetigen')throw new ProviderFailure({code:'invalid_response'});
   const registered=new URL('/auth/bestaetigen',callback.origin);registered.searchParams.set('anbieter','google');
   url.searchParams.set('redirect_uri',registered.href);url.searchParams.set('scope','openid email profile');url.searchParams.set('prompt','select_account');
   set(flowCookie,JSON.stringify({state,verifier,redirectTo:registered.href,appCallback:redirectTo,expiresAt:Date.now()+600000}),600);return {url:url.href};
  }),
  completeGoogle:(code,state)=>attempt<SessionResult['data']>({user:null,session:null},async()=>{
   const raw=cookie(flowCookie);set(flowCookie,'',0);if(!raw)throw new ProviderFailure({code:'invalid_credentials'});
   const flow=object(JSON.parse(raw));if(state!==flow.state||typeof flow.expiresAt!=='number'||flow.expiresAt<=Date.now())throw new ProviderFailure({code:'invalid_credentials'});
   const result=object(await api(collection+'/auth-with-oauth2','POST',{provider:'google',code,codeVerifier:text(flow.verifier),redirectUrl:text(flow.redirectTo,4096)}));
   const session=await adopt(result,'google'),meta=object(result.meta),googleAccessToken=text(meta.accessToken,4096);
   return {...session,session:{user:session.user,googleAccessToken}};
  }),
  confirmEmail:(token,format='token')=>attempt<{confirmed:boolean}>({confirmed:false},async()=>{if(format!=='token')throw new ProviderFailure({code:'invalid_credentials'});await api(collection+'/confirm-verification','POST',{token});return {confirmed:true};}),
  acceptRecovery:(recovery,format='token')=>attempt<{ready:boolean}>({ready:false},async()=>{if(format!=='token')throw new ProviderFailure({code:'invalid_credentials'});resetSubject(recovery);token='';nonce='';method=null;set(sessionCookie,'',0);set(recoveryCookie,recovery,600);return {ready:true};}),
  callbackReturn(type){try{const name=type==='google'?flowCookie:prefix+'-email-'+type,raw=cookie(name);if(!raw)return null;const value=object(JSON.parse(raw));if(typeof value.expiresAt!=='number'||value.expiresAt<=Date.now())return null;if(type!=='google')set(name,'',0);return text(type==='google'?value.appCallback:value.redirectTo,4096);}catch{return null;}},
  async recoveryReady(){try{const recovery=cookie(recoveryCookie);if(!recovery)return false;resetSubject(recovery);return true;}catch{return false;}},
  async requestRecovery(email,redirectTo){try{await api(collection+'/request-password-reset','POST',{email});set(prefix+'-email-recovery',JSON.stringify({redirectTo,expiresAt:Date.now()+3600000}),3600);return {error:null};}catch(e){return {error:failure(e)};}},
  resetPassword:password=>attempt<{identity:AuthUser['identity']|null}>({identity:null},async()=>{
   const recovery=cookie(recoveryCookie);if(!recovery)throw new ProviderFailure({code:'invalid_credentials'});
   resetSubject(recovery);
   await api(collection+'/confirm-password-reset','POST',{token:recovery,password,passwordConfirm:password});
   const identity=checkedIdentity({provider:'pocketbase',issuer:origin,subject:resetSubject(recovery)});
   set(recoveryCookie,'',0);return {identity};
  }),
  async signOut(){token='';nonce='';method=null;set(sessionCookie,'',0);set(recoveryCookie,'',0);set(flowCookie,'',0);return {error:null};}
 };
}
export function pocketbaseAdmin(origin:string,key:string):AuthAdminClient{
 const api=requestApi(origin,key),attributes=(input:AuthUserAttributes)=>({...input.email!==undefined?{email:input.email}:{},...input.password!==undefined?{password:input.password,passwordConfirm:input.password}:{},...input.name!==undefined?{name:input.name}:{},...input.preferredLocale!==undefined?{preferredLocale:input.preferredLocale}:{},...input.emailVerified!==undefined?{verified:input.emailVerified}:{}});
 const path=(id:string)=>collection+'/records/'+subject(id);
 const bound=(value:unknown,id:string)=>{const user=normalize(value,origin);if(user.identity.subject!==subject(id))throw new ProviderFailure({code:'invalid_response'});return user;};
 const profile=(user:AuthUser,input:AuthUserAttributes)=>{if(input.name!==undefined&&user.name!==input.name||input.preferredLocale!==undefined&&user.preferredLocale!==input.preferredLocale)throw new ProviderFailure({code:'invalid_response'});return user;};
 return {
  listUsers:params=>attempt({users:[] as AuthUser[],total:0},async()=>{const data=object(await api(collection+'/records?page='+params.page+'&perPage='+params.perPage));if(!Array.isArray(data.items)||!Number.isSafeInteger(data.totalItems)||Number(data.totalItems)<0)throw new ProviderFailure({code:'invalid_response'});return {users:data.items.map(user=>normalize(user,origin)),total:Number(data.totalItems)};}),
  getUserById:id=>attempt({user:null as AuthUser|null},async()=>({user:bound(await api(path(id)),id)})),
  createUser:input=>attempt({user:null as AuthUser|null},async()=>({user:profile(normalize(await api(collection+'/records','POST',attributes(input)),origin),input)})),
  updateUserById:(id,input)=>attempt({user:null as AuthUser|null},async()=>({user:profile(bound(await api(path(id),'PATCH',attributes(input)),id),input)})),
  deleteUser:id=>attempt({user:null},async()=>{const returned=await api(path(id),'DELETE');if(returned!==null)bound(returned,id);return {user:null};})
 };
}
