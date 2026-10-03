import {getAuthConfig,safeReturnPath,siteOrigin,providerAvailability} from "@/lib/auth/config";
import {authClient} from "@/lib/auth/client";
import {recordPasswordSession,revokeCurrentSession,providerAccountId} from "@/app/auth";
import {json,readJson,sameOrigin} from "@/lib/http";
import {storage} from "@/db/storage";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
async function rateLimit(request:Request,action:string,email:string){
 const ip=request.headers.get("cf-connecting-ip")??"unknown",window=Math.floor(Date.now()/600000),db=storage().db;
 await db.prepare("DELETE FROM auth_attempts WHERE expires_at<?").bind(Date.now()).run();
 const scopes:Array<[string,number]>=[[`ip:${ip}`,120]];if(email)scopes.push([`identity:${email}`,12]);
 for(const [scope,limit] of scopes){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${action}:${scope}`));
  const key=`${Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("")}:${window}`;
  const row=await db.prepare("INSERT INTO auth_attempts (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts").bind(key,Date.now()+1200000).first<{attempts:number}>();
  if((row?.attempts??1000)>limit)return true;
 }
 return false;
}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){if(!sameOrigin(request)||!request.headers.get("content-type")?.includes("application/json"))return json({error:"Ungültige Anfrage."},403);const {action}=await params;if(!["login","register","recovery","reset","logout","google"].includes(action))return json({error:"Ungültige Aktion."},404);let body:Record<string,unknown>;try{body=await readJson(request,8192);}catch{return json({error:"Bitte prüfe die Eingaben."},400);}try{const c=await getAuthConfig();if(!c?.enabled)return json({error:"Die Anmeldung wird gerade eingerichtet. Bitte versuche es später erneut."},503);if(["register","recovery"].includes(action)&&!c.emailDeliveryConfirmed)return json({error:"E-Mail-Anmeldung wird gerade eingerichtet. Bitte nutze Google oder versuche es später erneut."},503);const client=await authClient(c);
 if(action==="google"){
  if(!(await providerAvailability(c)).google)return json({error:"Google-Anmeldung ist gerade nicht verfügbar."},503);
  if(await rateLimit(request,action,""))return json({error:"Zu viele Versuche. Bitte warte einige Minuten."},429);
  const flow=crypto.randomUUID(),next=safeReturnPath(body.returnTo);
  const callback=new URL("/auth/bestaetigen",siteOrigin());callback.searchParams.set("anbieter","google");callback.searchParams.set("fluss",flow);callback.searchParams.set("weiter",next);
  const {data,error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:callback.href,scopes:"openid email profile",skipBrowserRedirect:true,queryParams:{prompt:"select_account"}}});
  if(error||!data.url)return json({error:"Google-Anmeldung ist gerade nicht verfügbar."},503);
  const target=new URL(data.url);if(target.origin!==c.projectUrl||target.pathname!=="/auth/v1/authorize")throw Error("INVALID_PROVIDER_REDIRECT");
  const local=["localhost","127.0.0.1"].includes(new URL(request.url).hostname);
  (await cookies()).set("riparim-google-flow",flow,{httpOnly:true,secure:!local,sameSite:"lax",path:"/auth/bestaetigen",maxAge:600});
  return json({url:data.url});
 }
 let resetUser=null;if(action==="reset"){const {data:{user},error}=await client.auth.getUser();if(error||!user?.email_confirmed_at)return json({error:"Öffne zuerst den gültigen Link aus deiner E-Mail oder melde dich an."},401);resetUser=user;}const rateIdentity=resetUser?providerAccountId(c.projectUrl,resetUser.id):String(body.email??"").trim().toLowerCase();if(action!=="logout"&&await rateLimit(request,action,rateIdentity))return json({error:"Zu viele Versuche. Bitte warte einige Minuten und versuche es erneut."},429);if(action==="logout"){await revokeCurrentSession(client);const {error}=await client.auth.signOut({scope:"local"});if(error)return json({error:"Abmelden fehlgeschlagen. Bitte versuche es erneut."},503);return json({returnTo:"/"});}
 const email=String(body.email??"").trim().toLowerCase(),password=String(body.password??""),next=safeReturnPath(body.returnTo);if(["login","register","recovery"].includes(action)&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return json({error:"Bitte gib eine gültige E-Mail-Adresse ein."},400);if(["register","reset"].includes(action)&&(password.length<12||password.length>128))return json({error:"Bitte nutze ein Passwort mit 12 bis 128 Zeichen."},400);
 if(action==="login"){const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.user?.email_confirmed_at)return json({error:"Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort und bestätige deine E-Mail-Adresse."},401);await recordPasswordSession(c.projectUrl,data.user,client);return json({returnTo:next});}
 if(action==="register"){const name=String(body.name??"").trim().slice(0,80);const {error}=await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:`${siteOrigin()}/auth/bestaetigen?weiter=${encodeURIComponent(next)}`}});if(error)return json({error:"Registrierung konnte gerade nicht abgeschlossen werden. Prüfe die Eingaben oder versuche es später erneut."},400);return json({message:"Prüfe dein Postfach und bestätige deine E-Mail-Adresse. Danach kannst du dich anmelden."});}
 if(action==="recovery"){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${siteOrigin()}/auth/bestaetigen?weiter=/passwort-neu`});if(error)return json({error:"Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut."},503);return json({message:"Wenn ein Konto existiert, erhältst du einen Link zum Zurücksetzen."});}
 if(!resetUser)return json({error:"Bitte öffne einen gültigen Wiederherstellungslink."},401);const {error}=await client.auth.updateUser({password});if(error)return json({error:"Das Passwort konnte nicht geändert werden. Bitte versuche es erneut."},400);await storage().db.prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=?").bind(providerAccountId(c.projectUrl,resetUser.id)).run();await client.auth.signOut({scope:"global"});return json({message:"Dein Passwort wurde geändert. Bitte melde dich erneut an.",returnTo:"/anmelden?hinweis=passwort-geaendert"});
 }catch(e){console.error("auth-action-unavailable",e instanceof Error?e.name:"unknown");return json({error:"Die Anmeldung ist gerade nicht verfügbar. Bitte versuche es später erneut."},503);}}
