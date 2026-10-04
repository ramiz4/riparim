import {env} from "cloudflare:workers";
import {createClient} from "@supabase/supabase-js";
import {getAuthConfig} from "./config";

export async function getAuthAdmin(){
 const config=await getAuthConfig(),key=env.SUPABASE_SECRET_KEY?.trim();
 if(!config||!key)return null;
 if(!key.startsWith("sb_secret_")){
  try{if(JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).role!=="service_role")return null;}
  catch{return null;}
 }
 // Separate privileged client: never shares cookies or credentials with browser sessions.
 const client=createClient(config.projectUrl,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)})}
 });
 return {client,projectUrl:config.projectUrl};
}
