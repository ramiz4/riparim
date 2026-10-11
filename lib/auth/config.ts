import {ValidationError} from "@/lib/validation-error";
import {validatedReturnPath} from "@/lib/auth/return-path";
import {env} from "@/lib/runtime/env";
import {storage} from "@/db/storage";
import {trustedAuthOrigin,providerFetch} from "./origin";
export type AuthConfig={projectUrl:string;publicKey:string;enabled:boolean;emailDeliveryConfirmed:boolean;updatedAt:string};
export async function getAuthConfig():Promise<AuthConfig|null>{
 const db=storage().db;
 let row=await db.prepare("SELECT * FROM auth_settings WHERE id='main'").first<Record<string,unknown>>();
 const requestedAt=env.EMAIL_LOGIN_ACTIVATION_TIME,requestedProject=env.EMAIL_LOGIN_ACTIVATION_PROJECT;
 // Apply an authorized configuration change once. A later owner edit always wins.
 if(row&&row.enabled===0&&requestedProject===row.project_url&&requestedAt&&Number.isFinite(Date.parse(requestedAt))&&Date.parse(requestedAt)<=Date.now()&&Date.parse(String(row.updated_at))<Date.parse(requestedAt)){
  try{
   await verifyProvider({projectUrl:String(row.project_url),publicKey:String(row.public_key)},false);
   await db.prepare("UPDATE auth_settings SET enabled=1,updated_at=? WHERE id='main' AND project_url=? AND public_key=? AND enabled=0 AND updated_at=?").bind(requestedAt,row.project_url,row.public_key,row.updated_at).run();
   row=await db.prepare("SELECT * FROM auth_settings WHERE id='main'").first<Record<string,unknown>>();
  }catch{/* Keep the saved settings when provider verification is unavailable. */}
 }
 if(!row)return null;
 let config;try{config=validatePublicConfig(String(row.project_url),String(row.public_key));}catch{return null;}
 return {...config,enabled:row.enabled===1,emailDeliveryConfirmed:row.email_delivery_confirmed===1,updatedAt:String(row.updated_at)};
}
export function siteOrigin(){return env.SITE_ORIGIN||"https://riparim.com";}
export function safeReturnPath(value:unknown,fallback="/?besuche=1"){return validatedReturnPath(value,siteOrigin(),fallback);}
export function validatePublicConfig(url:string,key:string){let origin:string;try{origin=trustedAuthOrigin(url);}catch{throw new ValidationError("auth_project_url","Bitte nutze die HTTPS-Projektadresse aus deinem Supabase-Projekt oder die serverseitig freigegebene Auth-Adresse.");}if(key.startsWith("sb_secret_")||key.length>1800)throw new ValidationError("auth_public_key","Hier darf nur ein öffentlicher Publishable- oder Anon-Key eingetragen werden, kein geheimer Schlüssel.");if(!/^sb_publishable_[a-zA-Z0-9_-]{20,}$/.test(key)){try{const p=JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));if(p.role!=="anon")throw Error();}catch{throw new ValidationError("auth_public_key","Bitte nutze den öffentlichen Publishable-Key oder den bisherigen Anon-Key.");}}return {projectUrl:origin,publicKey:key};}
type ProviderSettings={external?:{email?:boolean;google?:boolean};mailer_autoconfirm?:boolean;disable_signup?:boolean};
async function providerSettings(config:{projectUrl:string;publicKey:string}):Promise<ProviderSettings>{
 try{
  const origin=trustedAuthOrigin(config.projectUrl),response=await providerFetch(origin,5000)(`${origin}/auth/v1/settings`,{headers:{apikey:config.publicKey},cache:"no-store"});
  if(!response.ok)throw Error("AUTH_PROVIDER_UNAVAILABLE");
  return response.json();
 }catch{throw new ValidationError("auth_provider_connection","Die Projektverbindung konnte nicht bestätigt werden. Prüfe Projektadresse und öffentlichen Schlüssel.");}
}
export async function providerAvailability(config:AuthConfig|null){
 const unavailable={email:false,emailSignup:false,emailRecovery:false,google:false};
 if(!config?.enabled)return unavailable;
 try{
  const s=await providerSettings(config),email=s.external?.email===true&&s.mailer_autoconfirm===false;
  return {email,emailSignup:email&&s.disable_signup!==true,emailRecovery:email&&config.emailDeliveryConfirmed,google:s.external?.google===true};
 }catch{return unavailable;}
}
export async function verifyProvider(config:{projectUrl:string;publicKey:string},emailDeliveryConfirmed=true){
 const s=await providerSettings(config),email=s.external?.email===true&&s.mailer_autoconfirm===false;
 if(emailDeliveryConfirmed){if(!email||s.disable_signup===true)throw new ValidationError("auth_email_confirmation","Aktiviere E-Mail-Anmeldung, Registrierung und E-Mail-Bestätigung. Automatische Bestätigung muss ausgeschaltet sein.");}
 else if(!email&&s.external?.google!==true)throw new ValidationError("auth_provider_required","Aktiviere E-Mail mit E-Mail-Bestätigung oder verbinde Google im Auth-Projekt.");
}
