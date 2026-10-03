import {getChatGPTUser,type ChatGPTUser} from "./chatgpt-auth";
import {authClient} from "@/lib/auth/client";
import {getAuthConfig} from "@/lib/auth/config";
import {allowsLegacyAccess,allowsGoogleModeration,googleIdentityMatches,verifiedGoogleProfile,type LegacyLink,type SessionGrant} from "@/lib/auth/policy";
import {storage,moderatorEmail} from "@/db/storage";
import type {User,SupabaseClient,Session} from "@supabase/supabase-js";

export type AppUser=ChatGPTUser&{provider:string;ownerKeys:string[];isModerator:boolean};
function legacy(u:ChatGPTUser):AppUser{return {...u,provider:"ChatGPT",ownerKeys:[u.userId],isModerator:u.email.toLowerCase()===moderatorEmail()};}
export function providerAccountId(projectUrl:string,userId:string){return `supabase:${new URL(projectUrl).hostname}:${userId}`;}

// Only matching, authenticated native identity may establish a legacy owner link.
// A link established during Google OAuth never upgrades password access.
export async function linkLegacyAccount(projectUrl:string,u:User,source:"password"|"google"="password"){
 if(!u.email||!u.email_confirmed_at)return;
 const old=await getChatGPTUser();if(!old||old.email.toLowerCase()!==u.email.toLowerCase())return;
 const db=storage().db,accountId=providerAccountId(projectUrl,u.id);
 await db.prepare("INSERT OR IGNORE INTO auth_links (account_id,legacy_owner,owner_admin,created_at,password_access) VALUES (?,?,?,?,?)").bind(accountId,old.userId,old.email.toLowerCase()===moderatorEmail()?1:0,new Date().toISOString(),source==="password"?1:0).run();
 if(source==="password")await db.prepare("UPDATE auth_links SET password_access=1 WHERE account_id=? AND legacy_owner=?").bind(accountId,old.userId).run();
}

async function verifiedSessionId(client:SupabaseClient,user:User,method:"password"|"oauth"){
 const {data,error}=await client.auth.getClaims(),claims=data?.claims;
 if(error||!user.email_confirmed_at||claims?.sub!==user.id||typeof claims.session_id!=="string"||!Array.isArray(claims.amr)||!claims.amr.some(proof=>typeof proof==="object"&&proof!==null&&proof.method===method))throw Error("INVALID_AUTH_SESSION");
 return claims.session_id;
}

async function enrollSession(projectUrl:string,user:User,sessionId:string,grant:{provider:"password"|"google";googleSubject?:string;moderator?:boolean;legacyAccess:boolean}){
 const db=storage().db;
 await db.prepare("DELETE FROM auth_sessions WHERE expires_at<?").bind(Date.now()).run();
 await db.prepare("INSERT INTO auth_sessions (id,account_id,revoked,legacy_access,expires_at,created_at,provider,google_subject,moderator) VALUES (?,?,0,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(sessionId,providerAccountId(projectUrl,user.id),grant.legacyAccess?1:0,Date.now()+30*86400000,new Date().toISOString(),grant.provider,grant.googleSubject??null,grant.moderator?1:0).run();
}

export async function recordPasswordSession(projectUrl:string,user:User,client:SupabaseClient){
 const sessionId=await verifiedSessionId(client,user,"password");
 await linkLegacyAccount(projectUrl,user,"password");
 const link=await storage().db.prepare("SELECT legacy_owner,password_access FROM auth_links WHERE account_id=?").bind(providerAccountId(projectUrl,user.id)).first<LegacyLink>();
 await enrollSession(projectUrl,user,sessionId,{provider:"password",legacyAccess:link?.password_access===1});
}

export async function recordGoogleSession(projectUrl:string,session:Session,client:SupabaseClient){
 // The provider token comes exclusively from a successful server-side PKCE exchange.
 // Linked account metadata or a previous Google identity cannot prove this session.
 if(!session.provider_token)throw Error("INVALID_GOOGLE_SESSION");
 const {data:{user},error}=await client.auth.getUser();if(error||!user||user.id!==session.user.id)throw Error("INVALID_GOOGLE_SESSION");
 const sessionId=await verifiedSessionId(client,user,"oauth");
 const result=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${session.provider_token}`},cache:"no-store",signal:AbortSignal.timeout(8000)});
 if(!result.ok)throw Error("INVALID_GOOGLE_SESSION");
 const google=verifiedGoogleProfile(user,await result.json());
 // Keep only Supabase session credentials in the HTTP-only cookies.
 const {error:sessionError}=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
 if(sessionError)throw Error("INVALID_GOOGLE_SESSION");
 await linkLegacyAccount(projectUrl,user,"google");
 const link=await storage().db.prepare("SELECT legacy_owner,password_access FROM auth_links WHERE account_id=?").bind(providerAccountId(projectUrl,user.id)).first<LegacyLink>();
 await enrollSession(projectUrl,user,sessionId,{provider:"google",googleSubject:google.sub,moderator:google.email.toLowerCase()===moderatorEmail(),legacyAccess:!!link});
}

export async function revokeCurrentSession(client:SupabaseClient){const {data}=await client.auth.getClaims();if(typeof data?.claims?.session_id==="string")await storage().db.prepare("UPDATE auth_sessions SET revoked=1 WHERE id=?").bind(data.claims.session_id).run();}

export async function getAppUser():Promise<AppUser|null>{
 const c=await getAuthConfig();if(!c?.enabled){const u=await getChatGPTUser();return u?legacy(u):null;}
 const client=await authClient(c,true),{data:{user},error}=await client.auth.getUser();
 if(error||!user?.email||!user.email_confirmed_at)return null;
 const id=providerAccountId(c.projectUrl,user.id),claims=await client.auth.getClaims(),sessionId=claims.data?.claims?.session_id;
 if(claims.error||claims.data?.claims?.sub!==user.id||typeof sessionId!=="string")return null;
 const session=await storage().db.prepare("SELECT legacy_access,provider,google_subject,moderator FROM auth_sessions WHERE id=? AND account_id=? AND revoked=0 AND expires_at>?").bind(sessionId,id,Date.now()).first<SessionGrant>();
 if(!session||!["password","google"].includes(session.provider))return null;
 if(session.provider==="google"&&(!googleIdentityMatches(user,session.google_subject)||!claims.data?.claims?.amr?.some(proof=>typeof proof==="object"&&proof!==null&&proof.method==="oauth")))return null;
 const link=await storage().db.prepare("SELECT legacy_owner,password_access FROM auth_links WHERE account_id=?").bind(id).first<LegacyLink>();
 const fullName=typeof user.user_metadata?.full_name==="string"?user.user_metadata.full_name:null;
 return {userId:id,email:user.email,fullName,displayName:fullName??user.email,provider:session.provider==="google"?"Google":"E-Mail",ownerKeys:allowsLegacyAccess(session,link)?[id,link!.legacy_owner]:[id],isModerator:allowsGoogleModeration(user,session,moderatorEmail())};
}

export async function getAdminUser(current?:AppUser|null):Promise<AppUser|null>{const platform=await getChatGPTUser();if(platform&&platform.email.toLowerCase()===moderatorEmail())return legacy(platform);return current!==undefined?current:getAppUser();}
export function ownerPair(user:AppUser):[string,string]{return [user.ownerKeys[0],user.ownerKeys[1]??user.ownerKeys[0]];}
export function ownsVisit(user:AppUser,owner:string){return user.ownerKeys.includes(owner);}
