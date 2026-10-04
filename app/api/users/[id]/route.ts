import {getAdminUser,providerAccountId} from "@/app/auth";
import {getAuthAdmin} from "@/lib/auth/admin";
import {blockAccount} from "@/lib/auth/account-status";
import {changeAccountRole} from "@/lib/auth/roles";
import {storage,moderatorEmail,cleanupVisitEvidence} from "@/db/storage";
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
  const {data,error}=await auth.client.auth.admin.getUserById(id);if(error||!data.user)return providerFailure(error);
  if(protectedUser(data.user,admin,auth.projectUrl))return json({error:"Das Administratorkonto kann nicht gelöscht werden."},403);
  const accountId=providerAccountId(auth.projectUrl,id),db=storage().db;
  const link=await db.prepare("SELECT legacy_owner FROM auth_links WHERE account_id=?").bind(accountId).first<{legacy_owner:string}>();
  await blockAccount(accountId,"deleted");
  if(link)await blockAccount(link.legacy_owner,"deleted");
  // Retain blocked accounts and visit rows on failure so the full cleanup can be retried.
  const owners:[string,string]=[accountId,link?.legacy_owner??accountId];
  await db.prepare("UPDATE visits SET status='deleting',revision=revision+1 WHERE owner IN (?,?)").bind(...owners).run();
  const visits=await db.prepare("SELECT id,owner FROM visits WHERE owner IN (?,?)").bind(...owners).all<{id:string;owner:string}>();
  for(const visit of visits.results)await cleanupVisitEvidence(visit.owner,visit.id);
  await db.prepare("DELETE FROM visits WHERE owner IN (?,?) AND status='deleting'").bind(...owners).run();
  await db.batch([
   db.prepare("DELETE FROM auth_sessions WHERE account_id=?").bind(accountId),
   db.prepare("DELETE FROM auth_account_roles WHERE account_id=?").bind(accountId),
   db.prepare("DELETE FROM auth_links WHERE account_id=?").bind(accountId)
  ]);
  const deleted=await auth.client.auth.admin.deleteUser(id);if(deleted.error)throw Error("PROVIDER_DELETE_FAILED");
  return json({ok:true});
 }catch{return json({error:"Der Benutzer konnte nicht vollständig gelöscht werden. Eine begonnene Löschung hält das Konto gesperrt. Bitte versuche es erneut."},503);}
}
