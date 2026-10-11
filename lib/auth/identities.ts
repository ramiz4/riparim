import {storage} from "@/db/storage";

export type AccountIdentity={provider:string;issuer:string;subject:string};
function checked(identity:AccountIdentity){
 const url=new URL(identity.issuer);
 if(!/^[a-z][a-z0-9_-]{0,31}$/.test(identity.provider)||url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/"||!identity.subject||identity.subject.length>512||/[\s\x00-\x1f]/.test(identity.subject))throw Error("INVALID_IDENTITY");
 if(identity.provider==="supabase"&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.subject))throw Error("INVALID_IDENTITY");
 return {...identity,issuer:url.origin};
}
export function supabaseIdentity(projectUrl:string,subject:string):AccountIdentity{
 return checked({provider:"supabase",issuer:projectUrl,subject});
}
// Compatibility belongs only at this boundary. Historical IDs are opaque
// account keys everywhere else, including private file paths.
function initialAccountId(identity:AccountIdentity){
 return identity.provider==="supabase"?`supabase:${new URL(identity.issuer).host}:${identity.subject}`:`account:${crypto.randomUUID()}`;
}
export async function resolveAccount(identity:AccountIdentity){
 identity=checked(identity);
 const db=storage().db;
 const find=()=>db.prepare("SELECT account_id FROM auth_identities WHERE provider=? AND issuer=? AND subject=?").bind(identity.provider,identity.issuer,identity.subject).first<{account_id:string}>();
 let row=await find();if(row)return row.account_id;
 await db.prepare("INSERT OR IGNORE INTO auth_identities (provider,issuer,subject,account_id,created_at) VALUES (?,?,?,?,?)").bind(identity.provider,identity.issuer,identity.subject,initialAccountId(identity),new Date().toISOString()).run();
 row=await find();if(!row)throw Error("IDENTITY_CONFLICT");return row.account_id;
}
export async function resolveSupabaseAccount(projectUrl:string,subject:string){return resolveAccount(supabaseIdentity(projectUrl,subject));}
export async function accountIdentity(accountId:string,provider:string,issuer:string){
 // Native ownership remains a separately proved legacy link.
 const db=storage().db,origin=new URL(issuer).origin;
 const find=()=>db.prepare("SELECT i.provider,i.issuer,i.subject FROM auth_identities i WHERE i.provider=? AND i.issuer=? AND (i.account_id=? OR i.account_id IN (SELECT account_id FROM auth_links WHERE legacy_owner=?))").bind(provider,origin,accountId,accountId).first<AccountIdentity>();
 const identity=await find();if(identity)return identity;
 const link=await db.prepare("SELECT account_id FROM auth_links WHERE legacy_owner=?").bind(accountId).first<{account_id:string}>();
 // A predecessor writer can create an account after migration. Import it at
 // this same compatibility boundary without inferring identity in callers.
 const historical=(link?.account_id??accountId).match(/^supabase:([^:]+):([0-9a-f-]{36})$/i);
 if(provider==="supabase"&&historical&&`https://${historical[1]}`===origin){await resolveSupabaseAccount(origin,historical[2]);return find();}
 return null;
}
export async function registerHistoricalDeletedAccounts(projectUrl:string){
 // After the additive migration, a predecessor may delete its provider user
 // before finishing local cleanup. Import those tombstones even without a
 // surviving provider listing, so the administrative retry inventory stays visible.
 const issuer=new URL(projectUrl).origin;
 const prefix=`supabase:${new URL(issuer).host}:`;
 const rows=await storage().db.prepare("SELECT account_id FROM auth_account_status WHERE status='deleted' AND substr(account_id,1,?)=? AND NOT EXISTS (SELECT 1 FROM auth_identities WHERE auth_identities.account_id=auth_account_status.account_id)").bind(prefix.length,prefix).all<{account_id:string}>();
 for(const row of rows.results)await accountIdentity(row.account_id,"supabase",issuer);
}
// This trusted server/offline operation requires independently checked proof of
// BOTH external identities. It is deliberately absent from public HTTP routes.
export async function linkAccountIdentity(existing:AccountIdentity,next:AccountIdentity,verify:(identity:AccountIdentity)=>Promise<boolean>){
 existing=checked(existing);next=checked(next);
 if(!await verify(existing)||!await verify(next))throw Error("IDENTITY_PROOF_REQUIRED");
 const db=storage().db;
 const current=await db.prepare("SELECT account_id FROM auth_identities WHERE provider=? AND issuer=? AND subject=?").bind(existing.provider,existing.issuer,existing.subject).first<{account_id:string}>();
 if(!current)throw Error("IDENTITY_NOT_REGISTERED");
 // An unmapped identity written by the predecessor can already own data. Never
 // merge that account, even if the additive mapping has not yet been created.
 const candidate=initialAccountId(next),accountId=current.account_id;
 const references=[["visits", "owner"], ["visits", "moderated_by"], ["auth_links", "account_id"], ["auth_sessions", "account_id"], ["auth_account_status", "account_id"], ["auth_account_roles", "account_id"], ["auth_account_roles", "assigned_by"], ["auth_account_deletions", "account_id"], ["evidence_uploads", "owner"], ["workshop_claims", "owner"], ["workshop_claims", "moderated_by"], ["workshop_owners", "account_id"], ["workshop_owners", "confirmed_by"], ["workshop_changes", "owner"], ["workshop_changes", "moderated_by"], ["review_notifications", "owner"]];
 const unused=references.map(([table,column])=>`NOT EXISTS (SELECT 1 FROM ${table} WHERE ${column}=?)`).join(" AND ");
 const results=await db.batch([
  db.prepare(`INSERT OR IGNORE INTO auth_identities (provider,issuer,subject,account_id,created_at) SELECT ?,?,?,?,? WHERE (?=? OR (${unused}))`).bind(next.provider,next.issuer,next.subject,accountId,new Date().toISOString(),candidate,accountId,...references.map(()=>candidate)),
  // Blocks and deletion tombstones belong to the stable account and are
  // deliberately retained when a verified blocked identity is migrated.
  // Changing the login identity is an explicit security boundary. Old grants
  // cannot be reused by a new issuer with a coincidentally equal session ID.
  db.prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=? AND EXISTS (SELECT 1 FROM auth_identities WHERE provider=? AND issuer=? AND subject=? AND account_id=?)").bind(accountId,next.provider,next.issuer,next.subject,accountId)
 ]);
 const linked=await db.prepare("SELECT account_id FROM auth_identities WHERE provider=? AND issuer=? AND subject=?").bind(next.provider,next.issuer,next.subject).first<{account_id:string}>();
 if(!results[0].meta.changes&&linked?.account_id!==accountId)throw Error("IDENTITY_CONFLICT");
 return accountId;
}
export function sessionIdentityMatches(session:{identity_provider:string|null;identity_issuer:string|null;identity_subject:string|null},identity:AccountIdentity,accountId:string){
 if(session.identity_provider===null&&session.identity_issuer===null&&session.identity_subject===null)return legacyIdentityMatches(accountId,identity);
 return session.identity_provider===identity.provider&&session.identity_issuer===identity.issuer&&session.identity_subject===identity.subject;
}
export function legacyIdentityMatches(accountId:string,identity:AccountIdentity){return identity.provider==="supabase"&&accountId===initialAccountId(identity);}
