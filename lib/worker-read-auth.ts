import {parseCookieHeader,serializeCookieHeader} from "@supabase/ssr";
import {getAuthConfig} from "./auth/config";
import {createAuthClient} from "./auth/provider";
import {resolveAppUser,type AppUser} from "./auth/app-user";
import {accountDeletionCookie,readDeletionGrantToken} from "./auth/deletion-read";

export function finishWorkerRead(response:Response,cookieHeaders:Headers=new Headers()){
 const headers=new Headers(response.headers);
 headers.set("Cache-Control","private, no-store");
 headers.set("X-Content-Type-Options","nosniff");
 headers.set("Referrer-Policy","strict-origin-when-cross-origin");
 for(const cookie of cookieHeaders.getSetCookie())headers.append("Set-Cookie",cookie);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

// This context belongs only to one owned Worker GET. Its cookie collector is
// used for the final API response; no framework/proxy mutation client is shared.
export async function workerReadAuth(request:Request,cookieHeaders:Headers){
 const cookies=new Map(parseCookieHeader(request.headers.get("Cookie")??"").map(cookie=>[cookie.name,cookie.value]));
 const config=request.headers.has("Cookie")?await getAuthConfig():null;
 const hostname=new URL(request.url).hostname,secure=!["localhost","127.0.0.1"].includes(hostname);
 const client=config?.enabled?createAuthClient(config,{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll(values){for(const {name,value,options} of values){cookies.set(name,value);cookieHeaders.append("Set-Cookie",serializeCookieHeader(name,value,options));}}},secure):null;
 let verified:ReturnType<NonNullable<typeof client>["getUser"]>|undefined;
 const readClient=client?{...client,getUser:()=>verified??=client.getUser()}:null;
 const getAppUser=()=>resolveAppUser(config,readClient);
 return {
  getAppUser,
  getAdminUser(current?:AppUser|null){return current!==undefined?Promise.resolve(current):getAppUser();},
  getAuthConfig:()=>Promise.resolve(config),
  readDeletionGrant:()=>readDeletionGrantToken(cookies.get(accountDeletionCookie)),
  async currentAccount(){
   const user=await getAppUser();
   if(!user||!config?.enabled||!["Google","E-Mail"].includes(user.provider))return null;
   // The resolver already bound this fresh provider identity to the account,
   // session and issuer. Reuse its verification inside this HTTP GET only.
   return {user,config};
  }
 };
}
