import {env} from "cloudflare:workers";
import {storage} from "@/db/storage";
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
 return row?{projectUrl:String(row.project_url),publicKey:String(row.public_key),enabled:row.enabled===1,emailDeliveryConfirmed:row.email_delivery_confirmed===1,updatedAt:String(row.updated_at)}:null;
}
export function siteOrigin(){return env.SITE_ORIGIN||"https://riparim.com";}
export function safeReturnPath(value:unknown,fallback="/?besuche=1"){if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//"))return fallback;try{const u=new URL(value,siteOrigin());return u.origin===siteOrigin()&&!/^\/(?:signin-with-chatgpt|signout-with-chatgpt|auth\/bestaetigen)/.test(u.pathname)?`${u.pathname}${u.search}${u.hash}`:fallback;}catch{return fallback;}}
export function validatePublicConfig(url:string,key:string){const u=new URL(url);if(u.protocol!=="https:"||! /^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)||u.port||u.username||u.password||u.search||u.hash||(u.pathname!=="/"&&u.pathname!==""))throw Error("Bitte nutze die HTTPS-Projektadresse aus deinem Supabase-Projekt.");if(key.startsWith("sb_secret_")||key.length>1800)throw Error("Hier darf nur ein öffentlicher Publishable- oder Anon-Key eingetragen werden, kein geheimer Schlüssel.");if(!/^sb_publishable_[a-zA-Z0-9_-]{20,}$/.test(key)){try{const p=JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));if(p.role!=="anon")throw Error();}catch{throw Error("Bitte nutze den öffentlichen Publishable-Key oder den bisherigen Anon-Key.");}}return {projectUrl:u.origin,publicKey:key};}
type ProviderSettings={external?:{email?:boolean;google?:boolean};mailer_autoconfirm?:boolean;disable_signup?:boolean};
async function providerSettings(config:{projectUrl:string;publicKey:string}):Promise<ProviderSettings>{const r=await fetch(`${config.projectUrl}/auth/v1/settings`,{headers:{apikey:config.publicKey},cache:"no-store",signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error("Die Projektverbindung konnte nicht bestätigt werden. Prüfe Projektadresse und öffentlichen Schlüssel.");return r.json();}
export async function providerAvailability(config:AuthConfig|null){
 const unavailable={email:false,emailSignup:false,emailRecovery:false,google:false};
 if(!config?.enabled)return unavailable;
 try{
  const s=await providerSettings(config),email=s.external?.email===true&&s.mailer_autoconfirm===false;
  return {email,emailSignup:email&&config.emailDeliveryConfirmed&&s.disable_signup!==true,emailRecovery:email&&config.emailDeliveryConfirmed,google:s.external?.google===true};
 }catch{return unavailable;}
}
export async function verifyProvider(config:{projectUrl:string;publicKey:string},emailDeliveryConfirmed=true){
 const s=await providerSettings(config),email=s.external?.email===true&&s.mailer_autoconfirm===false;
 if(emailDeliveryConfirmed){if(!email||s.disable_signup===true)throw Error("Aktiviere E-Mail-Anmeldung, Registrierung und E-Mail-Bestätigung. Automatische Bestätigung muss ausgeschaltet sein.");}
 else if(!email&&s.external?.google!==true)throw Error("Aktiviere E-Mail mit E-Mail-Bestätigung oder verbinde Google im Auth-Projekt.");
}
