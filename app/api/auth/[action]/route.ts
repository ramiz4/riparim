import {getAuthConfig,safeReturnPath,siteOrigin,providerAvailability} from "@/lib/auth/config";
import {authClient} from "@/lib/auth/client";
import {getAppUser,recordPasswordSession,revokeCurrentSession,providerAccountId} from "@/app/auth";
import {json,readJson,sameOrigin} from "@/lib/http";
import {storage} from "@/db/storage";
import {cookies} from "next/headers";
import {accountBlocked,providerBlocked} from "@/lib/auth/account-status";
import {rateLimit} from "@/lib/auth/rate-limit";
import {deletionProtected} from "@/lib/auth/deletion-grant";
export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){if(!sameOrigin(request)||!request.headers.get("content-type")?.includes("application/json"))return json({error:"Ungültige Anfrage."},403);const {action}=await params;if(!["login","register","recovery","reset","logout","google"].includes(action))return json({error:"Ungültige Aktion."},404);let body:Record<string,unknown>;try{body=await readJson(request,8192);}catch{return json({error:"Bitte prüfe die Eingaben."},400);}try{const c=await getAuthConfig();if(!c?.enabled)return json({error:"Die Anmeldung wird gerade eingerichtet. Bitte versuche es später erneut."},503);if(action==="recovery"&&!c.emailDeliveryConfirmed)return json({error:"Der E-Mail-Versand ist derzeit noch nicht verfügbar. Bitte versuche es später erneut."},503);if(["login","register","recovery","reset"].includes(action)){
  const ready=await providerAvailability(c),available=action==="register"?ready.emailSignup:action==="recovery"?ready.emailRecovery:ready.email;
  if(!available)return json({error:"E-Mail-Anmeldung ist gerade nicht verfügbar. Bitte versuche es später erneut."},503);
 }
 const client=await authClient(c);
 if(action==="google"){
  if(!(await providerAvailability(c)).google)return json({error:"Google-Anmeldung ist gerade nicht verfügbar."},503);
  if(await rateLimit(request,action,""))return json({error:"Zu viele Versuche. Bitte warte einige Minuten."},429);
  const reauth=body.reauthenticate===true;
  const current=reauth?await getAppUser():null;
  if(reauth&&(!current||current.provider!=="Google"||await deletionProtected(current)))return json({error:"Dieses Konto kann hier nicht gelöscht werden."},403);
  const flow=crypto.randomUUID(),next=reauth?"/einstellungen":safeReturnPath(body.returnTo);
  const callback=new URL("/auth/bestaetigen",siteOrigin());callback.searchParams.set("anbieter","google");callback.searchParams.set("fluss",flow);callback.searchParams.set("weiter",next);
  const {data,error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:callback.href,scopes:"openid email profile",skipBrowserRedirect:true,queryParams:{prompt:"select_account"}}});
  if(error||!data.url)return json({error:"Google-Anmeldung ist gerade nicht verfügbar."},503);
  const target=new URL(data.url);if(target.origin!==c.projectUrl||target.pathname!=="/auth/v1/authorize")throw Error("INVALID_PROVIDER_REDIRECT");
  const local=["localhost","127.0.0.1"].includes(new URL(request.url).hostname);
  (await cookies()).set("riparim-google-flow",flow,{httpOnly:true,secure:!local,sameSite:"lax",path:"/auth/bestaetigen",maxAge:600});
  if(reauth)(await cookies()).set("riparim-deletion-flow",JSON.stringify({flow,accountId:current!.userId,expiresAt:Date.now()+600000}),{httpOnly:true,secure:!local,sameSite:"lax",path:"/auth/bestaetigen",maxAge:600});
  else (await cookies()).set("riparim-deletion-flow","",{httpOnly:true,secure:!local,sameSite:"lax",path:"/auth/bestaetigen",maxAge:0});
  return json({url:data.url});
 }
 let resetUser=null;if(action==="reset"){const {data:{user},error}=await client.auth.getUser();if(error||!user?.email_confirmed_at||providerBlocked(user)||await accountBlocked(providerAccountId(c.projectUrl,user.id)))return json({error:"Öffne zuerst den gültigen Link aus deiner E-Mail oder melde dich an."},401);resetUser=user;}const rateIdentity=resetUser?providerAccountId(c.projectUrl,resetUser.id):String(body.email??"").trim().toLowerCase();if(action!=="logout"&&await rateLimit(request,action,rateIdentity))return json({error:"Zu viele Versuche. Bitte warte einige Minuten und versuche es erneut."},429);if(action==="logout"){await revokeCurrentSession(client);const {error}=await client.auth.signOut({scope:"local"});if(error)return json({error:"Abmelden fehlgeschlagen. Bitte versuche es erneut."},503);return json({returnTo:"/"});}
 const email=String(body.email??"").trim().toLowerCase(),password=String(body.password??""),next=safeReturnPath(body.returnTo);if(["login","register","recovery"].includes(action)&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return json({error:"Bitte gib eine gültige E-Mail-Adresse ein."},400);if(["register","reset"].includes(action)&&(password.length<12||password.length>128))return json({error:"Bitte nutze ein Passwort mit 12 bis 128 Zeichen."},400);
 if(action==="login"){const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.user?.email_confirmed_at)return json({error:"Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort und bestätige deine E-Mail-Adresse."},401);try{await recordPasswordSession(c.projectUrl,data.user,client);}catch(e){await client.auth.signOut({scope:"local"});if(e instanceof Error&&e.message==="ACCOUNT_DISABLED")return json({error:"Dieses Konto ist gesperrt. Bitte wende dich an die Verwaltung."},403);throw e;}return json({returnTo:next});}
 if(action==="register"){
  const name=String(body.name??"").trim().slice(0,80);
  const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:`${siteOrigin()}/auth/bestaetigen?weiter=${encodeURIComponent(next)}`}});
  if(error){
   if(error.status===429||error.code==="over_email_send_rate_limit"||error.code==="over_request_rate_limit")return json({error:"Zu viele Registrierungsversuche. Bitte warte einige Minuten und versuche es erneut."},429);
   if(error.code==="email_address_not_authorized")return json({error:"Die Bestätigungs-E-Mail kann derzeit nicht gesendet werden. Bitte versuche es später erneut."},503);
   return json({error:"Registrierung konnte gerade nicht abgeschlossen werden. Prüfe die Eingaben oder versuche es später erneut."},error.status&&error.status>=500?503:400);
  }
  // Signup never grants access before email confirmation and a separate login.
  if(data.session){await client.auth.signOut({scope:"local"});return json({error:"Die E-Mail-Bestätigung ist gerade nicht verfügbar. Bitte versuche es später erneut."},503);}
  if(!data.user)return json({error:"Die Registrierung konnte gerade nicht abgeschlossen werden. Bitte versuche es später erneut."},503);
  return json({message:"Prüfe dein Postfach und bestätige deine E-Mail-Adresse. Danach kannst du dich anmelden."});
 }
 if(action==="recovery"){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${siteOrigin()}/auth/bestaetigen?weiter=/passwort-neu`});if(error)return json({error:"Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut."},503);return json({message:"Wenn ein Konto existiert, erhältst du einen Link zum Zurücksetzen."});}
 if(!resetUser)return json({error:"Bitte öffne einen gültigen Wiederherstellungslink."},401);const {error}=await client.auth.updateUser({password});if(error)return json({error:"Das Passwort konnte nicht geändert werden. Bitte versuche es erneut."},400);await storage().db.prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=?").bind(providerAccountId(c.projectUrl,resetUser.id)).run();await client.auth.signOut({scope:"global"});return json({message:"Dein Passwort wurde geändert. Bitte melde dich erneut an.",returnTo:"/anmelden?hinweis=passwort-geaendert"});
 }catch(e){console.error("auth-action-unavailable",e instanceof Error?e.name:"unknown");return json({error:"Die Anmeldung ist gerade nicht verfügbar. Bitte versuche es später erneut."},503);}}
