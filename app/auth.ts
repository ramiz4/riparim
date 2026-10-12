import {publicAccountName} from "@/lib/account-name";
import {getChatGPTUser,type ChatGPTUser} from "./chatgpt-auth";
import {authClient} from "@/lib/auth/client";
import {getAuthConfig} from "@/lib/auth/config";
import {allowsLegacyAccess,allowsGoogleModeration,googleIdentityMatches,verifiedGoogleProfile,type LegacyLink,type SessionGrant} from "@/lib/auth/policy";
import {storage,moderatorEmail} from "@/db/storage";
import type {AuthUser as User,AuthClient,AuthSession as Session} from "@/lib/auth/contract";
import {legacySessionId} from "@/lib/auth/legacy-supabase";
import {resolveAccount,sessionIdentityMatches,type AccountIdentity} from "@/lib/auth/identities";
import {accountBlocked,providerBlocked} from "@/lib/auth/account-status";

export type AppUser=ChatGPTUser&{provider:string;ownerKeys:string[];isModerator:boolean};
function legacy(u:ChatGPTUser):AppUser{return {...u,provider:"ChatGPT",ownerKeys:[u.userId],isModerator:u.email.toLowerCase()===moderatorEmail()};}

// Only matching, authenticated native identity may establish a legacy owner link.
// A link established during Google OAuth never upgrades password access.
export async function linkLegacyAccount(u:User,source:"password"|"google"="password"){
 if(!u.email||!u.emailVerified)return;
 if(providerBlocked(u)||await accountBlocked(await resolveAccount(u.identity)))throw Error("ACCOUNT_DISABLED");
 const old=await getChatGPTUser();if(!old||old.email.toLowerCase()!==u.email.toLowerCase())return;
 if(await accountBlocked(old.userId))throw Error("ACCOUNT_DISABLED");
 const db=storage().db,accountId=await resolveAccount(u.identity);
 await db.prepare("INSERT OR IGNORE INTO auth_links (account_id,legacy_owner,owner_admin,created_at,password_access) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM auth_account_status WHERE account_id IN (?,?) AND status IN ('inactive','deleted'))").bind(accountId,old.userId,old.email.toLowerCase()===moderatorEmail()?1:0,new Date().toISOString(),source==="password"?1:0,accountId,old.userId).run();
 if(source==="password")await db.prepare("UPDATE auth_links SET password_access=1 WHERE account_id=? AND legacy_owner=?").bind(accountId,old.userId).run();
}

async function verifiedSessionId(client:AuthClient,user:User,method:"password"|"google"){
 const {data,error}=await client.getSessionProof(),proof=data.proof;
 if(error||!user.emailVerified||proof?.subject!==user.identity.subject||proof.method!==method)throw Error("INVALID_AUTH_SESSION");
 return proof.id;
}

function appSessionId(identity:AccountIdentity,id:string){return JSON.stringify([identity.provider,identity.issuer,id]);}
async function enrollSession(user:User,sessionId:string,grant:{provider:"password"|"google";googleSubject?:string;moderator?:boolean;legacyAccess:boolean}){
 if(providerBlocked(user)||await accountBlocked(await resolveAccount(user.identity)))throw Error("ACCOUNT_DISABLED");
 const db=storage().db;
 await db.prepare("DELETE FROM auth_sessions WHERE expires_at<?").bind(Date.now()).run();
 const accountId=await resolveAccount(user.identity);
 await db.prepare("INSERT INTO auth_sessions (id,account_id,revoked,legacy_access,expires_at,created_at,provider,google_subject,moderator,identity_provider,identity_issuer,identity_subject) SELECT ?,?,0,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM auth_account_status WHERE status IN ('inactive','deleted') AND (account_id=? OR account_id IN (SELECT legacy_owner FROM auth_links WHERE account_id=?))) ON CONFLICT(id) DO NOTHING").bind(appSessionId(user.identity,sessionId),accountId,grant.legacyAccess?1:0,Date.now()+30*86400000,new Date().toISOString(),grant.provider,grant.googleSubject??null,grant.moderator?1:0,user.identity.provider,user.identity.issuer,user.identity.subject,accountId,accountId).run();
 if(await accountBlocked(accountId))throw Error("ACCOUNT_DISABLED");
}

export async function recordPasswordSession(user:User,client:AuthClient){
 if(providerBlocked(user)||await accountBlocked(await resolveAccount(user.identity)))throw Error("ACCOUNT_DISABLED");
 const sessionId=await verifiedSessionId(client,user,"password");
 await linkLegacyAccount(user,"password");
 const link=await storage().db.prepare("SELECT legacy_owner,password_access FROM auth_links WHERE account_id=?").bind(await resolveAccount(user.identity)).first<LegacyLink>();
 await enrollSession(user,sessionId,{provider:"password",legacyAccess:link?.password_access===1});
}

export async function recordGoogleSession(session:Session,client:AuthClient){
 // The provider token comes exclusively from a successful server-side PKCE exchange.
 // Linked account metadata or a previous Google identity cannot prove this session.
 if(!session.googleAccessToken)throw Error("INVALID_GOOGLE_SESSION");
 const {data:{user},error}=await client.getUser();if(error||!user||user.identity.subject!==session.user.identity.subject||user.identity.provider!==session.user.identity.provider||user.identity.issuer!==session.user.identity.issuer)throw Error("INVALID_GOOGLE_SESSION");
 if(providerBlocked(user)||await accountBlocked(await resolveAccount(user.identity)))throw Error("ACCOUNT_DISABLED");
 const sessionId=await verifiedSessionId(client,user,"google");
 const result=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${session.googleAccessToken}`},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
 if(!result.ok)throw Error("INVALID_GOOGLE_SESSION");
 const google=verifiedGoogleProfile(user,await result.json());
 await linkLegacyAccount(user,"google");
 const link=await storage().db.prepare("SELECT legacy_owner,password_access FROM auth_links WHERE account_id=?").bind(await resolveAccount(user.identity)).first<LegacyLink>();
 await enrollSession(user,sessionId,{provider:"google",googleSubject:google.sub,moderator:google.email.toLowerCase()===moderatorEmail(),legacyAccess:!!link});
}

export async function revokeCurrentSession(client:AuthClient){
 const [{data,error},{data:verified,error:userError}]=await Promise.all([client.getSessionProof(),client.getUser()]);
 if(error||userError||!verified.user||!data.proof||data.proof.subject!==verified.user.identity.subject)return;
 const identity=verified.user.identity,account=await resolveAccount(identity),id=appSessionId(identity,data.proof.id),old=legacySessionId(identity,data.proof.id);
 await storage().db.prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=? AND (id=? OR (id=? AND ((identity_provider=? AND identity_issuer=? AND identity_subject=?) OR (identity_provider IS NULL AND identity_issuer IS NULL AND identity_subject IS NULL))))").bind(account,id,old??id,identity.provider,identity.issuer,identity.subject).run();
}

export async function getAppUser():Promise<AppUser|null>{
 const c=await getAuthConfig();if(!c?.enabled){const u=await getChatGPTUser();return u&&!await accountBlocked(u.userId)?legacy(u):null;}
 const client=await authClient(c,true),{data:{user},error}=await client.getUser();
 if(error||!user?.email||!user.emailVerified||user.identity.provider!==c.provider||user.identity.issuer!==c.projectUrl)return null;
 if(providerBlocked(user)||await accountBlocked(await resolveAccount(user.identity)))return null;
 const id=await resolveAccount(user.identity),proof=await client.getSessionProof(),sessionId=proof.data.proof?.id;
 if(proof.error||proof.data.proof?.subject!==user.identity.subject||typeof sessionId!=="string")return null;
 const link=await storage().db.prepare("SELECT legacy_owner,password_access FROM auth_links WHERE account_id=?").bind(id).first<LegacyLink>();
 // Read the session and role together: promotion must never upgrade an old
 // customer session that the same role-change transaction has just revoked.
 const session=await storage().db.prepare("SELECT s.legacy_access,s.provider,s.google_subject,s.moderator,s.identity_provider,s.identity_issuer,s.identity_subject,r.role AS account_role FROM auth_sessions s LEFT JOIN auth_account_roles r ON r.account_id=s.account_id WHERE s.id IN (?,?) AND s.account_id=? AND s.revoked=0 AND s.expires_at>? ORDER BY (s.id=?) DESC LIMIT 1").bind(appSessionId(user.identity,sessionId),legacySessionId(user.identity,sessionId)??appSessionId(user.identity,sessionId),id,Date.now(),appSessionId(user.identity,sessionId)).first<SessionGrant&{account_role:string|null;identity_provider:string|null;identity_issuer:string|null;identity_subject:string|null}>();
 if(!session||!["password","google"].includes(session.provider)||!sessionIdentityMatches(session,user.identity,id))return null;
 if(session.provider==="google"&&(!googleIdentityMatches(user,session.google_subject)||proof.data.proof?.method!==null&&proof.data.proof?.method!=="google"))return null;
 const fullName=user.name??null;
 return {userId:id,email:user.email,fullName,displayName:publicAccountName(fullName),provider:session.provider==="google"?"Google":"E-Mail",ownerKeys:allowsLegacyAccess(session,link)?[id,link!.legacy_owner]:[id],isModerator:allowsGoogleModeration(user,session,moderatorEmail())||session.account_role==="admin"};
}

export async function getAdminUser(current?:AppUser|null):Promise<AppUser|null>{const platform=await getChatGPTUser();if(platform&&platform.email.toLowerCase()===moderatorEmail())return legacy(platform);return current!==undefined?current:getAppUser();}
export function ownerPair(user:AppUser):[string,string]{return [user.ownerKeys[0],user.ownerKeys[1]??user.ownerKeys[0]];}
export function ownsVisit(user:AppUser,owner:string){return user.ownerKeys.includes(owner);}
