import {storage} from "@/db/storage";
import type {User} from "@supabase/supabase-js";

export function providerBlocked(user:User){
 const until=user.banned_until;
 return !!until&&Date.parse(until)>Date.now();
}

// Native access must honor a linked account's block, including after Auth is disabled.
export async function accountBlocked(accountId:string){
 const row=await storage().db.prepare("SELECT status FROM auth_account_status WHERE status IN ('inactive','deleted') AND (account_id=? OR account_id IN (SELECT account_id FROM auth_links WHERE legacy_owner=?) OR account_id IN (SELECT legacy_owner FROM auth_links WHERE account_id=?)) LIMIT 1").bind(accountId,accountId,accountId).first();
 return !!row;
}

export async function blockAccount(accountId:string,status:"inactive"|"deleted"){
 const db=storage().db;
 await db.batch([
  db.prepare("INSERT INTO auth_account_status (account_id,status,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at WHERE auth_account_status.status!='deleted'").bind(accountId,status,new Date().toISOString()),
  db.prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=?").bind(accountId)
 ]);
}
