import {storage} from "@/db/storage";
export async function rateLimit(request:Request,action:string,email:string){
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
