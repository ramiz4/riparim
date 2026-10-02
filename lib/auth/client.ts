import {cookies,headers} from "next/headers";
import {createServerClient} from "@supabase/ssr";
import {getAuthConfig,type AuthConfig} from "./config";

export async function authClient(config?:AuthConfig,allowReadOnly=false){
 const c=config??await getAuthConfig();
 if(!c?.enabled)throw Error("AUTH_NOT_CONFIGURED");
 const cookieStore=await cookies();
 const requestHeaders=await headers();
 const local=/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(requestHeaders.get("host")??"");
 return createServerClient(c.projectUrl,c.publicKey,{
  cookieOptions:{httpOnly:true,secure:!local,sameSite:"lax",path:"/"},
  cookies:{
   getAll(){return cookieStore.getAll();},
   setAll(values){
    try{values.forEach(({name,value,options})=>cookieStore.set(name,value,options));}
    catch(e){if(!allowReadOnly)throw e;/* Server Components rely on proxy.ts to persist refresh cookies. */}
   }
  }
 });
}
