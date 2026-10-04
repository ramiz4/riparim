import {storage,moderatorEmail} from "@/db/storage";
import type {AppUser} from "@/app/auth";
import type {AccountRole} from "@/lib/user-contract";

export function isBootstrapAccount(email:string|undefined){return !!moderatorEmail()&&email?.trim().toLowerCase()===moderatorEmail();}

export async function hasAdminRole(accountId:string){
 return !!await storage().db.prepare("SELECT account_id FROM auth_account_roles WHERE account_id=? AND role='admin'").bind(accountId).first();
}

export async function changeAccountRole(accountId:string,role:AccountRole,actor:AppUser){
 if(!actor.isModerator||accountId===actor.userId)throw Error("ROLE_CHANGE_FORBIDDEN");
 const db=storage().db,bootstrap=isBootstrapAccount(actor.email)?1:0;
 // Check authority inside the write transaction: two admins cannot demote each
 // other concurrently and then use their already-read permissions to remove both.
 const allowed="(?=1 OR EXISTS (SELECT 1 FROM auth_account_roles WHERE account_id=? AND role='admin')) AND NOT EXISTS (SELECT 1 FROM auth_account_status WHERE status IN ('inactive','deleted') AND (account_id=? OR account_id IN (SELECT legacy_owner FROM auth_links WHERE account_id=?))) AND NOT EXISTS (SELECT 1 FROM auth_account_status WHERE account_id=? AND status='deleted')";
 const authority=[bootstrap,actor.userId,actor.userId,actor.userId,accountId];
 const statement=role==="admin"
  ?db.prepare(`INSERT INTO auth_account_roles (account_id,role,assigned_at,assigned_by) SELECT ?,'admin',?,? WHERE ${allowed} ON CONFLICT(account_id) DO UPDATE SET role=excluded.role,assigned_at=excluded.assigned_at,assigned_by=excluded.assigned_by`).bind(accountId,new Date().toISOString(),actor.userId,...authority)
  :db.prepare(`DELETE FROM auth_account_roles WHERE account_id=? AND ${allowed}`).bind(accountId,...authority);
 const results=await db.batch([
  statement,
  db.prepare(`UPDATE auth_sessions SET revoked=1 WHERE account_id=? AND ${allowed}`).bind(accountId,...authority)
 ]);
 if(!results[0].meta.changes)throw Error("ROLE_CHANGE_FORBIDDEN");
}
