import {ValidationError} from "@/lib/validation-error";
import {isLocale} from "@/lib/i18n/locale";
import {getAppUser,providerAccountId} from "@/app/auth";
import {authClient} from "@/lib/auth/client";
import {getAuthConfig} from "@/lib/auth/config";
import {getAuthAdmin} from "@/lib/auth/admin";
import {accountBlocked} from "@/lib/auth/account-status";
import {isBootstrapAccount} from "@/lib/auth/roles";
import {clearDeletionGrant,deletionProtected,issueDeletionGrant,readDeletionGrant,startDeletion} from "@/lib/auth/deletion-grant";
import {deleteAccount} from "@/lib/auth/delete-account";
import {verifyPassword} from "@/lib/auth/password-proof";
import {rateLimit} from "@/lib/auth/rate-limit";
import {parseUserFields} from "@/lib/admin-users";
import {json,readJson,sameOrigin} from "@/lib/http";

export const dynamic="force-dynamic";
function logFailure(operation:string,error:unknown){console.error("account-operation-failed",{operation,reason:error instanceof Error?error.name:"unknown"});}
const unavailable=()=>json({error:"Die Kontoverwaltung ist gerade nicht verfügbar. Bitte versuche es erneut.",errorCode:"account_unavailable"},503);
async function currentAccount(){
 const user=await getAppUser(),config=await getAuthConfig();
 if(!user||!config?.enabled||!["Google","E-Mail"].includes(user.provider))return null;
 const client=await authClient(config),{data,error}=await client.auth.getUser();
 if(error||!data.user?.email_confirmed_at||user.userId!==providerAccountId(config.projectUrl,data.user.id))return null;
 return {user,config,client,providerUser:data.user};
}
async function input(request:Request){
 if(!sameOrigin(request)||!request.headers.get("content-type")?.includes("application/json"))throw Error("INVALID_REQUEST");
 return readJson(request,2048);
}
export async function GET(){
 try{
  const current=await currentAccount(),grant=await readDeletionGrant(),config=await getAuthConfig();
  const validGrant=grant&&config?.enabled&&grant.account_id===providerAccountId(config.projectUrl,grant.user_id)?grant:null;
  if(!current||validGrant?.started)return json({account:null,deletionReady:false,deletionStarted:!!validGrant?.started});
  return json({account:{email:current.user.email,name:current.user.displayName,provider:current.user.provider,protected:await deletionProtected(current.user)},deletionReady:!!validGrant&&validGrant.account_id===current.user.userId,deletionStarted:!!validGrant?.started});
 }catch(e){logFailure("read",e);return unavailable();}
}
export async function PATCH(request:Request){
 let body;try{body=await input(request);}catch{return json({error:"Ungültige Anfrage.",errorCode:"invalid_request"},400);}
 try{
  const current=await currentAccount();if(!current)return json({error:"Bitte melde dich mit Google oder E-Mail an.",errorCode:"authentication_required"},401);
  if(Object.keys(body).length!==1||(!("name" in body)&&!("preferredLocale" in body))||("preferredLocale" in body&&!isLocale(body.preferredLocale)))return json({error:"Nur der Anzeigename kann hier geändert werden.",errorCode:"invalid_account_patch"},400);
  const preference="preferredLocale" in body;
  let fields;try{fields=preference?{}:parseUserFields(body);}catch(e){return json({error:e instanceof ValidationError?e.message:"Bitte prüfe den Namen.",errorCode:e instanceof ValidationError?e.code:"invalid_request"},400);}
  if(await accountBlocked(current.user.userId))return json({error:"Die Kontolöschung wurde bereits begonnen.",errorCode:"account_blocked"},409);
  const auth=await getAuthAdmin();if(!auth||auth.projectUrl!==current.config.projectUrl)return unavailable();
  const {data,error}=await auth.client.auth.admin.updateUserById(current.providerUser.id,{user_metadata:{...current.providerUser.user_metadata,...(preference?{preferred_locale:body.preferredLocale}:{full_name:fields.name})}});
  if(error||!data.user)return unavailable();
  return json(preference?{preferredLocale:body.preferredLocale,messageCode:"saved"}:{name:fields.name,messageCode:"saved"});
 }catch(e){logFailure("rename",e);return unavailable();}
}
export async function POST(request:Request){
 let body;try{body=await input(request);}catch{return json({error:"Ungültige Anfrage.",errorCode:"invalid_request"},400);}
 try{
  const current=await currentAccount();if(!current)return json({error:"Bitte melde dich an.",errorCode:"authentication_required"},401);
  if(current.user.provider!=="E-Mail"||await deletionProtected(current.user))return json({error:"Dieses Konto kann hier nicht gelöscht werden.",errorCode:"deletion_protected"},403);
  if(Object.keys(body).length!==1||typeof body.password!=="string"||!body.password.length||body.password.length>128)return json({error:"Bitte gib dein aktuelles Passwort ein.",errorCode:"current_password_required"},400);
  if(await rateLimit(request,"account-reauth",current.user.userId))return json({error:"Zu viele Versuche. Bitte warte einige Minuten.",errorCode:"rate_limited"},429);
  if(!await verifyPassword(current.config,current.providerUser.id,current.providerUser.email!,body.password))return json({error:"Das Passwort konnte nicht bestätigt werden.",errorCode:"password_proof_failed"},401);
  if(await accountBlocked(current.user.userId))return json({error:"Dieses Konto ist gesperrt.",errorCode:"account_blocked"},403);
  await issueDeletionGrant(current.user,current.config.projectUrl,current.providerUser.id);
  return json({ok:true});
 }catch(e){logFailure("reauthenticate",e);return unavailable();}
}
export async function DELETE(request:Request){
 let body;try{body=await input(request);}catch{return json({error:"Ungültige Anfrage.",errorCode:"invalid_request"},400);}
 if(Object.keys(body).length!==1||body.confirmation!=="KONTO LÖSCHEN")return json({error:"Bitte bestätige die Kontolöschung ausdrücklich.",errorCode:"deletion_confirmation_required"},400);
 try{
  const grant=await readDeletionGrant(),config=await getAuthConfig();
  if(!grant||!config?.enabled||grant.account_id!==providerAccountId(config.projectUrl,grant.user_id))return json({error:"Bitte bestätige deine Identität erneut.",errorCode:"reauthentication_required"},401);
  if(!grant.started){
   const current=await currentAccount();
   if(!current||current.user.userId!==grant.account_id)return json({error:"Bitte bestätige deine Identität erneut.",errorCode:"reauthentication_required"},401);
   if(await deletionProtected(current.user))return json({error:"Administrationszugänge sind gegen eigene Löschung geschützt.",errorCode:"deletion_protected"},403);
  }
  const auth=await getAuthAdmin();if(!auth||auth.projectUrl!==config.projectUrl)return unavailable();
  const lookup=await auth.client.auth.admin.getUserById(grant.user_id);
  if(lookup.error&&lookup.error.status!==404&&lookup.error.code!=="user_not_found")return unavailable();
  if(isBootstrapAccount(lookup.data.user?.email))return json({error:"Der ursprüngliche Verwaltungszugang ist geschützt.",errorCode:"deletion_protected"},403);
  await startDeletion(grant);
  await deleteAccount(auth,grant.user_id);
  await clearDeletionGrant(grant);
  // Local tombstones and removed session grants deny any surviving provider JWT.
  try{await (await authClient(config)).auth.signOut({scope:"local"});}catch{}
  return json({ok:true});
 }catch(e){
  if(e instanceof Error&&e.message==="DELETION_FORBIDDEN")return json({error:"Administrationszugänge sind gegen eigene Löschung geschützt.",errorCode:"deletion_protected"},403);
  logFailure("delete",e);
  return json({error:"Die Löschung konnte nicht abgeschlossen werden. Dein Konto bleibt nach Beginn gesperrt. Bitte wiederhole die Löschung hier; falls nötig hilft die Verwaltung.",errorCode:"deletion_incomplete"},503);
 }
}
