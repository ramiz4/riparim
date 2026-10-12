// Historical fixtures retain provider payloads for their independent expected
// values. Their public test doubles now implement Riparim's neutral contract.
export function authUser(user,issuer){
 if(!user)return null;if(typeof issuer==='function')issuer=issuer();
 return {identity:{provider:'supabase',issuer,subject:user.id},email:user.email,emailVerified:!!user.email_confirmed_at,name:user.user_metadata?.full_name,preferredLocale:user.user_metadata?.preferred_locale,createdAt:user.created_at,lastSignInAt:user.last_sign_in_at,blocked:!!user.banned_until&&Date.parse(user.banned_until)>Date.now(),loginProviders:[...new Set(user.identities?.map(value=>value.provider)??[])],googleIdentities:(user.identities??[]).flatMap(value=>value.provider==='google'&&typeof value.identity_data?.sub==='string'?[{subject:value.identity_data.sub,email:value.identity_data.email,emailVerified:value.identity_data.email_verified===true}]:[])};
}
export function authSession(session,issuer){return session?{user:authUser(session.user,issuer),googleAccessToken:session.provider_token}:null;}
const failure=value=>value?{...value,code:({user_not_found:'not_found',user_already_exists:'email_exists',over_email_send_rate_limit:'rate_limited',over_request_rate_limit:'rate_limited',email_address_not_authorized:'email_unavailable'})[value.code]??value.code}:null;
export function authClient(raw,issuer){
 const client=raw.auth??raw;
 const result=value=>({...value,error:failure(value.error),data:{...value.data,user:authUser(value.data?.user,issuer),session:authSession(value.data?.session,issuer)}});
 return {
  getUser:async()=>result(await client.getUser()),
  getSessionProof:async()=>{const value=await client.getClaims(),claims=value.data?.claims;return {error:failure(value.error),data:{proof:claims?{id:claims.session_id,subject:claims.sub,method:claims.amr?.some(entry=>entry?.method==='oauth')?'google':claims.amr?.some(entry=>entry?.method==='password')?'password':claims.amr?.some(entry=>entry?.method==='recovery')?'recovery':'unknown'}:null}};},
  signInWithPassword:async value=>result(await client.signInWithPassword(value)),
  signUp:async value=>result(await client.signUp({email:value.email,password:value.password,options:{data:{full_name:value.name,preferred_locale:value.preferredLocale},emailRedirectTo:value.redirectTo}})),
  beginGoogle:redirectTo=>client.signInWithOAuth({provider:'google',options:{redirectTo,scopes:'openid email profile',skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}}),
  completeGoogle:async code=>{const value=await client.exchangeCodeForSession(code);if(value.data?.session&&!value.error)await client.setSession?.({access_token:value.data.session.access_token,refresh_token:value.data.session.refresh_token});return result(value);},
  confirmEmail:async(token,format='token')=>{const value=format==='code'?await client.exchangeCodeForSession(token):await client.verifyOtp({token_hash:token,type:'signup'});return {data:{confirmed:!!value.data?.user?.email_confirmed_at},error:failure(value.error)};},
  acceptRecovery:async(token,format='token')=>{const value=format==='code'?await client.exchangeCodeForSession(token):await client.verifyOtp({token_hash:token,type:'recovery'});return {data:{ready:!!value.data?.user?.email_confirmed_at},error:failure(value.error)};},
  callbackReturn:()=>null,
  recoveryReady:async()=>{const value=await client.getUser();return !value.error&&!!value.data?.user?.email_confirmed_at;},
  requestRecovery:async(email,redirectTo)=>{const value=await client.resetPasswordForEmail(email,{redirectTo});return {error:failure(value.error)};},
  resetPassword:async password=>{const value=await client.updateUser({password});return {data:{identity:authUser(value.data?.user,issuer)?.identity??null},error:failure(value.error)};},
  signOut:async value=>({error:failure((await client.signOut(value)).error)})
 };
}
export function authAdmin(raw,issuer){
 const attributes=value=>({...value.email!==undefined?{email:value.email}:{},...value.password!==undefined?{password:value.password}:{},...value.name!==undefined||value.preferredLocale!==undefined?{user_metadata:{...value.name!==undefined?{full_name:value.name}:{},...value.preferredLocale!==undefined?{preferred_locale:value.preferredLocale}:{}}}:{},...value.emailVerified!==undefined?{email_confirm:value.emailVerified}:{},...value.active!==undefined?{ban_duration:value.active?'none':'876000h'}:{}});
 const result=value=>({...value,error:failure(value.error),data:{...value.data,user:authUser(value.data?.user,issuer),...value.data?.users?{users:value.data.users.map(user=>authUser(user,issuer))}:{}}});
 return {listUsers:async value=>result(await raw.listUsers(value)),getUserById:async id=>result(await raw.getUserById(id)),createUser:async value=>result(await raw.createUser(attributes(value))),updateUserById:async(id,value)=>result(await raw.updateUserById(id,attributes(value))),deleteUser:async id=>result(await raw.deleteUser(id))};
}
