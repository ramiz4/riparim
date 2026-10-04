import type {AppUser} from "@/app/auth";
import {moderatorEmail} from "@/db/storage";

// Recheck delegated authority and linked access blocks in the same transaction
// as the decision. A previously read session cannot outlive a role revocation.
export function moderationAuthority(user:AppUser){
 if(!user.isModerator)return {sql:"0",values:[]};
 const bootstrap=!!moderatorEmail()&&user.email.toLowerCase()===moderatorEmail();
 return {
  sql:"(?=1 OR EXISTS (SELECT 1 FROM auth_account_roles WHERE account_id=? AND role='admin')) AND NOT EXISTS (SELECT 1 FROM auth_account_status WHERE status IN ('inactive','deleted') AND (account_id=? OR account_id IN (SELECT legacy_owner FROM auth_links WHERE account_id=?) OR account_id IN (SELECT account_id FROM auth_links WHERE legacy_owner=?)))",
  values:[bootstrap?1:0,user.userId,user.userId,user.userId,user.userId]
 };
}
