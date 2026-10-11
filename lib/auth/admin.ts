import {env} from "@/lib/runtime/env";
import {createAuthAdminClient} from "./provider";
import {authSecretMatchesOrigin} from "./origin";
import {getAuthConfig} from "./config";

export async function getAuthAdmin(){
 const config=await getAuthConfig(),key=env.SUPABASE_SECRET_KEY?.trim();
 if(!config||!key||!authSecretMatchesOrigin(config.projectUrl))return null;
 if(!key.startsWith("sb_secret_")){
  try{if(JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).role!=="service_role")return null;}
  catch{return null;}
 }
 // Separate privileged client: never shares cookies or credentials with browser sessions.
 const client=createAuthAdminClient(config.projectUrl,key);
 return {client,projectUrl:config.projectUrl};
}
