import type {User} from "@supabase/supabase-js";
import type {AppUser} from "@/app/auth";
import {providerAccountId} from "@/app/auth";
import {storage,moderatorEmail} from "@/db/storage";
import {providerBlocked} from "@/lib/auth/account-status";
import {json} from "@/lib/http";

export function protectedUser(user:User,admin:AppUser,projectUrl:string){
 return providerAccountId(projectUrl,user.id)===admin.userId||!!moderatorEmail()&&user.email?.trim().toLowerCase()===moderatorEmail();
}
export async function userView(user:User,admin:AppUser,projectUrl:string){
 const status=await storage().db.prepare("SELECT status FROM auth_account_status WHERE account_id=?").bind(providerAccountId(projectUrl,user.id)).first<{status:string}>();
 return {id:user.id,email:user.email??"",name:typeof user.user_metadata?.full_name==="string"?user.user_metadata.full_name:"",active:!status&&!providerBlocked(user),confirmed:!!user.email_confirmed_at,createdAt:user.created_at,lastSignInAt:user.last_sign_in_at??null,providers:[...new Set(user.identities?.map(identity=>identity.provider)??[])],protected:protectedUser(user,admin,projectUrl)};
}
export function validUserId(id:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);}
export function parseUserFields(body:Record<string,unknown>,creating=false){
 const allowed=creating?["name","email","password","active"]:["name","email","password","active"];
 if(!Object.keys(body).length||Object.keys(body).some(key=>!allowed.includes(key)))throw Error("Bitte prüfe die Eingaben.");
 if(!creating&&"active" in body&&Object.keys(body).length!==1)throw Error("Bitte ändere den Kontostatus getrennt von den Benutzerdaten.");
 const fields:{name?:string;email?:string;password?:string;active?:boolean}={};
 if(creating||"name" in body){if(typeof body.name!=="string"||body.name.trim().length<2||body.name.trim().length>80)throw Error("Bitte gib einen Namen mit 2 bis 80 Zeichen ein.");fields.name=body.name.trim();}
 if(creating||"email" in body){if(typeof body.email!=="string"||body.email.trim().length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))throw Error("Bitte gib eine gültige E-Mail-Adresse ein.");fields.email=body.email.trim().toLowerCase();}
 if(creating||"password" in body){if(typeof body.password!=="string"||body.password.length<12||body.password.length>128)throw Error("Bitte nutze ein Passwort mit 12 bis 128 Zeichen.");fields.password=body.password;}
 if("active" in body){if(typeof body.active!=="boolean")throw Error("Bitte wähle einen gültigen Kontostatus.");fields.active=body.active;}else if(creating)fields.active=true;
 return fields;
}
export function providerFailure(error:{code?:string;status?:number}|null){
 if(error?.code==="email_exists"||error?.code==="user_already_exists")return json({error:"Diese E-Mail-Adresse wird bereits verwendet."},409);
 if(error?.code==="user_not_found"||error?.status===404)return json({error:"Benutzer nicht gefunden."},404);
 if(error?.code==="weak_password")return json({error:"Bitte wähle ein stärkeres Passwort."},400);
 return json({error:"Die Benutzerverwaltung ist gerade nicht verfügbar. Bitte versuche es erneut."},503);
}
export const notConfigured=()=>json({error:"Für die Benutzerverwaltung muss der geheime Supabase-Schlüssel in der Serverkonfiguration hinterlegt sein."},503);
