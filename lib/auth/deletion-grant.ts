import {cookies,headers} from "next/headers";
import {storage} from "@/db/storage";
import {providerAccountId,type AppUser} from "@/app/auth";
import {isBootstrapAccount,hasAdminRole} from "@/lib/auth/roles";

const cookieName="riparim-account-deletion";
const retrySeconds=7*86400;
export type DeletionGrant={account_id:string;user_id:string;token_hash:string;expires_at:number;started:number};
async function digest(token:string){
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
 return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function setCookie(token:string,maxAge:number){
 const host=(await headers()).get("host")??"";
 (await cookies()).set(cookieName,token,{httpOnly:true,secure:!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host),sameSite:"strict",path:"/",maxAge});
}
export async function deletionProtected(user:AppUser){
 if(user.isModerator||isBootstrapAccount(user.email)||await hasAdminRole(user.userId))return true;
 return !!await storage().db.prepare("SELECT account_id FROM auth_links WHERE account_id=? AND owner_admin=1").bind(user.userId).first();
}
export async function issueDeletionGrant(user:AppUser,projectUrl:string,id:string){
 if(user.userId!==providerAccountId(projectUrl,id)||await deletionProtected(user))throw Error("DELETION_FORBIDDEN");
 const token=crypto.randomUUID()+crypto.randomUUID(),hash=await digest(token),db=storage().db;
 await db.prepare("DELETE FROM auth_account_deletions WHERE expires_at<?").bind(Date.now()).run();
 const row=await db.prepare("INSERT INTO auth_account_deletions (account_id,user_id,token_hash,expires_at,started) VALUES (?,?,?,?,0) ON CONFLICT(account_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at WHERE auth_account_deletions.started=0 RETURNING account_id").bind(user.userId,id,hash,Date.now()+600000).first();
 if(!row)throw Error("DELETION_STARTED");
 await setCookie(token,retrySeconds);
}
export async function readDeletionGrant(){
 const token=(await cookies()).get(cookieName)?.value;
 if(!token||! /^[0-9a-f-]{72}$/.test(token))return null;
 return storage().db.prepare("SELECT * FROM auth_account_deletions WHERE token_hash=? AND expires_at>?").bind(await digest(token),Date.now()).first<DeletionGrant>();
}
export async function startDeletion(grant:DeletionGrant){
 const db=storage().db;
 // Role checks and the access block share one transaction. A concurrent
 // promotion cannot turn an administrator into an unprotected self-deletion.
 const permitted="EXISTS (SELECT 1 FROM auth_account_deletions WHERE token_hash=? AND expires_at>?) AND NOT EXISTS (SELECT 1 FROM auth_account_roles WHERE account_id=? AND role='admin') AND NOT EXISTS (SELECT 1 FROM auth_links WHERE account_id=? AND owner_admin=1)";
 const results=await db.batch([
  db.prepare(`INSERT INTO auth_account_status (account_id,status,updated_at) SELECT ?,'deleted',? WHERE ${permitted} ON CONFLICT(account_id) DO UPDATE SET status='deleted',updated_at=excluded.updated_at`).bind(grant.account_id,new Date().toISOString(),grant.token_hash,Date.now(),grant.account_id,grant.account_id),
  db.prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=? AND EXISTS (SELECT 1 FROM auth_account_status WHERE account_id=? AND status='deleted')").bind(grant.account_id,grant.account_id),
  db.prepare("UPDATE auth_account_deletions SET started=1,expires_at=? WHERE token_hash=? AND EXISTS (SELECT 1 FROM auth_account_status WHERE account_id=? AND status='deleted')").bind(Date.now()+retrySeconds*1000,grant.token_hash,grant.account_id)
 ]);
 if(!results[0].meta.changes)throw Error("DELETION_FORBIDDEN");
}
export async function clearDeletionGrant(grant:DeletionGrant){
 await storage().db.prepare("DELETE FROM auth_account_deletions WHERE account_id=?").bind(grant.account_id).run();
 await setCookie("",0);
}
