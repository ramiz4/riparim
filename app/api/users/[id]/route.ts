import {getAdminUser,providerAccountId} from "@/app/auth";
import {getAuthAdmin} from "@/lib/auth/admin";
import {blockAccount} from "@/lib/auth/account-status";
import {changeAccountRole} from "@/lib/auth/roles";
import {storage,moderatorEmail} from "@/db/storage";
import {deleteAccount} from "@/lib/auth/delete-account";
import {json,readJson,sameOrigin} from "@/lib/http";
import {protectedUser,userView,validUserId,parseUserFields,providerFailure,notConfigured} from "@/lib/admin-users";
import type {AdminUserAttributes} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};

export async function PATCH(request:Request,{params}:Context){
 try{
  const admin=await getAdminUser();if(!admin)return json({error:"Bitte melde dich an."},401);if(!admin.isModerator||!sameOrigin(request))return json({error:"Kein Zugriff auf die Benutzerverwaltung."},403);
  const id=(await params).id.toLowerCase();if(!validUserId(id))return json({error:"Ungültige Benutzerkennung."},400);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"Ungültige Anfrage."},400);
  let fields;try{fields=parseUserFields(await readJson(request,8192));}catch(e){return json({error:e instanceof Error?e.message:"Bitte prüfe die Eingaben."},400);}
  const auth=await getAuthAdmin();if(!auth)return notConfigured();
  const {data:current,error:lookupError}=await auth.client.auth.admin.getUserById(id);if(lookupError||!current.user)return providerFailure(lookupError);
  const user=current.user,accountId=providerAccountId(auth.projectUrl,id),db=storage().db;
  if(protectedUser(user,admin,auth.projectUrl)&&("role" in fields||"active" in fields||fields.email!==undefined&&fields.email!==user.email?.toLowerCase()))return json({error:"Dein eigener und der ursprüngliche Verwaltungszugang sind geschützt: Rolle, Kontostatus und E-Mail-Adresse können nicht geändert werden."},403);
  if(fields.email===moderatorEmail()&&fields.email!==user.email?.toLowerCase())return json({error:"Diese E-Mail-Adresse ist für die Verwaltung reserviert."},403);
  const status=await db.prepare("SELECT status FROM auth_account_status WHERE account_id=?").bind(accountId).first<{status:string}>();
  if(status?.status==="deleted")return json({error:"Die Löschung dieses Kontos wurde bereits begonnen. Bitte schließe sie über Löschen ab."},409);
  if(fields.role!==undefined){
   const before=await userView(user,admin,auth.projectUrl);
   const roleChanged=before.role!==fields.role;
   if(roleChanged)try{await changeAccountRole(accountId,fields.role,admin);}catch(e){if(e instanceof Error&&e.message==="ROLE_CHANGE_FORBIDDEN")return json({error:"Die Rollenänderung ist nicht mehr erlaubt. Bitte aktualisiere die Benutzerverwaltung und melde dich bei Bedarf erneut an."},403);throw e;}
   return json({user:await userView(user,admin,auth.projectUrl),roleChanged});
  }
  const attributes:AdminUserAttributes={};
  if(fields.name!==undefined)attributes.user_metadata={...user.user_metadata,full_name:fields.name};
  if(fields.email!==undefined&&fields.email!==user.email?.toLowerCase())attributes.email=fields.email;
  if(fields.password!==undefined)attributes.password=fields.password;
  if(fields.active!==undefined){
   if(!fields.active)await blockAccount(accountId,"inactive");
   attributes.ban_duration=fields.active?"none":"876000h";
  }
  if(attributes.email||attributes.password)await db.prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=?").bind(accountId).run();
  const {data,error}=await auth.client.auth.admin.updateUserById(id,attributes);if(error||!data.user)return providerFailure(error);
  if(fields.active===true)await db.prepare("DELETE FROM auth_account_status WHERE account_id=? AND status='inactive'").bind(accountId).run();
  return json({user:await userView(data.user,admin,auth.projectUrl)});
 }catch{return providerFailure(null);}
}

export async function DELETE(request:Request,{params}:Context){
 try{
  const admin=await getAdminUser();if(!admin)return json({error:"Bitte melde dich an."},401);if(!admin.isModerator||!sameOrigin(request))return json({error:"Kein Zugriff auf die Benutzerverwaltung."},403);
  const id=(await params).id.toLowerCase();if(!validUserId(id))return json({error:"Ungültige Benutzerkennung."},400);
  const auth=await getAuthAdmin();if(!auth)return notConfigured();
  const {data,error}=await auth.client.auth.admin.getUserById(id);
  if(error?.status===404||error?.code==="user_not_found"){
   const accountId=providerAccountId(auth.projectUrl,id);
   if(accountId===admin.userId)return json({error:"Das Administratorkonto kann nicht gelöscht werden."},403);
   const tombstone=await storage().db.prepare("SELECT account_id FROM auth_account_status WHERE account_id=? AND status='deleted'").bind(accountId).first();
   if(!tombstone)return providerFailure(error);
  }else if(error||!data.user)return providerFailure(error);
  if(data.user&&protectedUser(data.user,admin,auth.projectUrl))return json({error:"Das Administratorkonto kann nicht gelöscht werden."},403);
  await deleteAccount(auth,id);
  return json({ok:true});
 }catch{return json({error:"Der Benutzer konnte nicht vollständig gelöscht werden. Eine begonnene Löschung hält das Konto gesperrt. Bitte versuche es erneut."},503);}
}
