import {getChatGPTUser,type ChatGPTUser} from "./chatgpt-auth";
import {authClient} from "@/lib/auth/client";
import {getAuthConfig} from "@/lib/auth/config";
import {storage,moderatorEmail} from "@/db/storage";
import type {User,SupabaseClient} from "@supabase/supabase-js";
export type AppUser=ChatGPTUser&{provider:string;ownerKeys:string[];isModerator:boolean};
function legacy(u:ChatGPTUser):AppUser{return {...u,provider:"ChatGPT",ownerKeys:[u.userId],isModerator:u.email.toLowerCase()===moderatorEmail()};}
export function providerAccountId(projectUrl:string,userId:string){return `supabase:${new URL(projectUrl).hostname}:${userId}`;}
export async function linkLegacyAccount(projectUrl:string,u:User){if(!u.email||!u.email_confirmed_at)return;const old=await getChatGPTUser();if(!old||old.email.toLowerCase()!==u.email.toLowerCase())return;await storage().db.prepare("INSERT OR IGNORE INTO auth_links (account_id,legacy_owner,owner_admin,created_at) VALUES (?,?,?,?)").bind(providerAccountId(projectUrl,u.id),old.userId,old.email.toLowerCase()===moderatorEmail()?1:0,new Date().toISOString()).run();}
export async function recordPasswordSession(projectUrl:string,user:User,client:SupabaseClient){
 await linkLegacyAccount(projectUrl,user);
 const {data,error}=await client.auth.getClaims();
 const sessionId=data?.claims?.session_id;
 if(error||typeof sessionId!=="string")throw Error("INVALID_AUTH_SESSION");
 const accountId=providerAccountId(projectUrl,user.id),db=storage().db;
 const link=await db.prepare("SELECT legacy_owner FROM auth_links WHERE account_id=?").bind(accountId).first();
 await db.prepare("DELETE FROM auth_sessions WHERE expires_at<?").bind(Date.now()).run();
 await db.prepare("INSERT INTO auth_sessions (id,account_id,revoked,legacy_access,expires_at,created_at) VALUES (?,?,0,?,?,?) ON CONFLICT(id) DO UPDATE SET revoked=0,legacy_access=excluded.legacy_access,expires_at=excluded.expires_at").bind(sessionId,accountId,link?1:0,Date.now()+30*86400000,new Date().toISOString()).run();
}
export async function revokeCurrentSession(client:SupabaseClient){const {data}=await client.auth.getClaims();if(typeof data?.claims?.session_id==="string")await storage().db.prepare("UPDATE auth_sessions SET revoked=1 WHERE id=?").bind(data.claims.session_id).run();}
export async function getAppUser():Promise<AppUser|null>{const c=await getAuthConfig();if(!c?.enabled){const u=await getChatGPTUser();return u?legacy(u):null;}const client=await authClient(c,true);const {data:{user},error}=await client.auth.getUser();if(error||!user?.email||!user.email_confirmed_at)return null;const id=providerAccountId(c.projectUrl,user.id),claims=await client.auth.getClaims(),sessionId=claims.data?.claims?.session_id;if(claims.error||typeof sessionId!=="string")return null;const session=await storage().db.prepare("SELECT legacy_access FROM auth_sessions WHERE id=? AND account_id=? AND revoked=0 AND expires_at>?").bind(sessionId,id,Date.now()).first<{legacy_access:number}>();if(!session)return null;const link=await storage().db.prepare("SELECT legacy_owner,owner_admin FROM auth_links WHERE account_id=?").bind(id).first<{legacy_owner:string;owner_admin:number}>();const fullName=typeof user.user_metadata?.full_name==="string"?user.user_metadata.full_name:null;return {userId:id,email:user.email,fullName,displayName:fullName??user.email,provider:"E-Mail",ownerKeys:link&&session.legacy_access===1?[id,link.legacy_owner]:[id],isModerator:session.legacy_access===1&&link?.owner_admin===1};}
export async function getAdminUser(current?:AppUser|null):Promise<AppUser|null>{const platform=await getChatGPTUser();if(platform&&platform.email.toLowerCase()===moderatorEmail())return legacy(platform);return current!==undefined?current:getAppUser();}
export function ownerPair(user:AppUser):[string,string]{return [user.ownerKeys[0],user.ownerKeys[1]??user.ownerKeys[0]];}
export function ownsVisit(user:AppUser,owner:string){return user.ownerKeys.includes(owner);}
