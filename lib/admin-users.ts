import {ValidationError} from "@/lib/validation-error";
import type {User} from "@supabase/supabase-js";
import type {AppUser} from "@/app/auth";
import {providerAccountId} from "@/app/auth";
import {storage} from "@/db/storage";
import {providerBlocked} from "@/lib/auth/account-status";
import {isBootstrapAccount} from "@/lib/auth/roles";
import {json} from "@/lib/http";
import type {AccountRole,ManagedUser} from "@/lib/user-contract";

export function protectedUser(user:User,admin:AppUser,projectUrl:string){
 return providerAccountId(projectUrl,user.id)===admin.userId||isBootstrapAccount(user.email);
}
export async function userView(user:User,admin:AppUser,projectUrl:string):Promise<ManagedUser>{
 const accountId=providerAccountId(projectUrl,user.id);
 const state=await storage().db.prepare("SELECT (SELECT status FROM auth_account_status WHERE account_id=?) AS status,(SELECT role FROM auth_account_roles WHERE account_id=?) AS role").bind(accountId,accountId).first<{status:string|null;role:string|null}>();
 return {id:user.id,email:user.email??"",name:typeof user.user_metadata?.full_name==="string"?user.user_metadata.full_name:"",role:isBootstrapAccount(user.email)||state?.role==="admin"?"admin":"user",active:!state?.status&&!providerBlocked(user),confirmed:!!user.email_confirmed_at,createdAt:user.created_at??null,lastSignInAt:user.last_sign_in_at??null,providers:[...new Set(user.identities?.map(identity=>identity.provider)??[])],protected:protectedUser(user,admin,projectUrl)};
}
export function validUserId(id:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);}
export function parseUserFields(body:Record<string,unknown>,creating=false){
 const allowed=creating?["name","email","password","active"]:["name","email","password","active","role"];
 if(!Object.keys(body).length||Object.keys(body).some(key=>!allowed.includes(key)))throw new ValidationError("invalid_request","Bitte prüfe die Eingaben.");
 if(!creating&&("active" in body||"role" in body)&&Object.keys(body).length!==1)throw new ValidationError("account_fields_separate","Bitte ändere Rolle und Kontostatus getrennt von den Benutzerdaten.");
 const fields:{name?:string;email?:string;password?:string;active?:boolean;role?:AccountRole}={};
 if(creating||"name" in body){if(typeof body.name!=="string"||body.name.trim().length<2||body.name.trim().length>80)throw new ValidationError("invalid_name","Bitte gib einen Namen mit 2 bis 80 Zeichen ein.");fields.name=body.name.trim();}
 if(creating||"email" in body){if(typeof body.email!=="string"||body.email.trim().length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))throw new ValidationError("invalid_email","Bitte gib eine gültige E-Mail-Adresse ein.");fields.email=body.email.trim().toLowerCase();}
 if(creating||"password" in body){if(typeof body.password!=="string"||body.password.length<12||body.password.length>128)throw new ValidationError("invalid_password","Bitte nutze ein Passwort mit 12 bis 128 Zeichen.");fields.password=body.password;}
 if("active" in body){if(typeof body.active!=="boolean")throw new ValidationError("account_status_invalid","Bitte wähle einen gültigen Kontostatus.");fields.active=body.active;}else if(creating)fields.active=true;
 if("role" in body){if(body.role!=="admin"&&body.role!=="user")throw new ValidationError("account_role_invalid","Bitte wähle die Rolle Benutzer oder Admin.");fields.role=body.role;}
 return fields;
}
export function providerFailure(error:{code?:string;status?:number}|null){
 if(error?.code==="email_exists"||error?.code==="user_already_exists")return json({error:"Diese E-Mail-Adresse wird bereits verwendet.",errorCode:"user_email_exists"},409);
 if(error?.code==="user_not_found"||error?.status===404)return json({error:"Benutzer nicht gefunden.",errorCode:"user_not_found"},404);
 if(error?.code==="weak_password")return json({error:"Bitte wähle ein stärkeres Passwort.",errorCode:"user_password_weak"},400);
 return json({error:"Die Benutzerverwaltung ist gerade nicht verfügbar. Bitte versuche es erneut.",errorCode:"users_unavailable"},503);
}
export const notConfigured=()=>json({error:"Für die Benutzerverwaltung muss der geheime Supabase-Schlüssel in der Serverkonfiguration hinterlegt sein.",errorCode:"users_configuration_missing"},503);
