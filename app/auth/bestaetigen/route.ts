import {getAuthConfig,safeReturnPath,siteOrigin} from "@/lib/auth/config";
import {authClient} from "@/lib/auth/client";
import {recordGoogleSession} from "@/app/auth";
import {cookies} from "next/headers";
import type {SupabaseClient} from "@supabase/supabase-js";

export const dynamic="force-dynamic";
function redirectTo(path:string){return new Response(null,{status:303,headers:{Location:new URL(path,siteOrigin()).href,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});}

export async function GET(request:Request){
 const p=new URL(request.url).searchParams,token=p.get("token_hash"),code=p.get("code"),type=p.get("type"),google=p.get("anbieter")==="google";
 const next=safeReturnPath(p.get("weiter"),type==="recovery"?"/passwort-neu":"/?besuche=1");
 let client:SupabaseClient|undefined;
 try{
  const c=await getAuthConfig();if(!c?.enabled||p.has("error"))throw Error("AUTH_CALLBACK_UNAVAILABLE");
  if(google){
   const cookieStore=await cookies(),flow=cookieStore.get("riparim-google-flow")?.value;
   cookieStore.set("riparim-google-flow","",{httpOnly:true,secure:!["localhost","127.0.0.1"].includes(new URL(request.url).hostname),sameSite:"lax",path:"/auth/bestaetigen",maxAge:0});
   if(!code||!flow||p.get("fluss")!==flow||token||type)throw Error("INVALID_GOOGLE_FLOW");
   client=await authClient(c);
   const {data,error}=await client.auth.exchangeCodeForSession(code);
   if(error||!data.session)throw Error("INVALID_GOOGLE_CODE");
   await recordGoogleSession(c.projectUrl,data.session,client);
   return redirectTo(next);
  }
  if(code||(token&&["signup","recovery"].includes(type??""))){
   client=await authClient(c);
   const {data,error}=code?await client.auth.exchangeCodeForSession(code):await client.auth.verifyOtp({token_hash:token!,type:type as "signup"|"recovery"});
   if(!error&&data.user?.email_confirmed_at){
    if(type==="recovery"||next==="/passwort-neu")return redirectTo(next);
    await client.auth.signOut({scope:"local"});
    return redirectTo(`/anmelden?hinweis=email-bestaetigt&weiter=${encodeURIComponent(next)}`);
   }
  }
 }catch(e){
  if(google&&client)try{await client.auth.signOut({scope:"local"});}catch{}
  console.error("auth-confirmation-unavailable",e instanceof Error?e.name:"unknown");
 }
 return redirectTo(`/anmelden?fehler=${google?"google":"bestaetigung"}&weiter=${encodeURIComponent(next)}`);
}
