import {createClient} from "@supabase/supabase-js";
import type {AuthConfig} from "@/lib/auth/config";

// Reauthentication must not replace the browser's enrolled session or create a
// legacy ownership link. Its isolated provider session is signed out afterwards.
export async function verifyPassword(config:AuthConfig,id:string,email:string,password:string){
 const client=createClient(config.projectUrl,config.publicKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}
 });
 try{
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error||!data.user?.email_confirmed_at||data.user.id!==id)return false;
  const verified=await client.auth.getUser();
  return !verified.error&&verified.data.user?.id===id;
 }finally{await client.auth.signOut({scope:"local"});}
}
