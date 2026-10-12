import {storage} from '@/db/storage';
import {checkedIdentity,accountIdentity,resolveAccount,type AccountIdentity} from './identities';

// Preserve historical ownership keys, hosted cookies and predecessor tombstones.
// New providers use opaque internal account IDs instead of embedding external IDs.
export function supabaseIdentity(issuer:string,subject:string):AccountIdentity{
 if(new URL(issuer).pathname!=='/'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject))throw Error('INVALID_IDENTITY');
 return checkedIdentity({provider:'supabase',issuer,subject});
}
export function initialAccountId(identity:AccountIdentity){return identity.provider==='supabase'?`supabase:${new URL(identity.issuer).host}:${identity.subject}`:`account:${crypto.randomUUID()}`;}
export function legacyIdentityMatches(accountId:string,identity:AccountIdentity){return identity.provider==='supabase'&&accountId===initialAccountId(identity);}
export async function registerHistoricalDeletedAccounts(projectUrl:string){
 const issuer=new URL(projectUrl).origin,prefix=`supabase:${new URL(issuer).host}:`;
 const rows=await storage().db.prepare("SELECT account_id FROM auth_account_status WHERE status='deleted' AND substr(account_id,1,?)=? AND NOT EXISTS (SELECT 1 FROM auth_identities WHERE auth_identities.account_id=auth_account_status.account_id)").bind(prefix.length,prefix).all<{account_id:string}>();
 for(const row of rows.results)await accountIdentity(row.account_id,'supabase',issuer);
}

export function legacySessionId(identity:AccountIdentity,id:string){return identity.provider==='supabase'?id:null;}

export async function resolveSupabaseAccount(issuer:string,subject:string){return resolveAccount(supabaseIdentity(issuer,subject));}
export function historicalAccountIdentity(accountId:string,provider:string,issuer:string){
 const match=accountId.match(/^supabase:([^:]+):([0-9a-f-]{36})$/i);
 return provider==='supabase'&&match&&`https://${match[1]}`===issuer?supabaseIdentity(issuer,match[2]):null;
}
