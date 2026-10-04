import {providerAccountId} from "@/app/auth";
import {storage,cleanupVisitEvidence} from "@/db/storage";
import {blockAccount} from "@/lib/auth/account-status";
import type {getAuthAdmin} from "@/lib/auth/admin";

// Keep the ownership link until provider deletion succeeds. It is the retry
// inventory even if every visit has already been removed.
export async function deleteAccount(auth:NonNullable<Awaited<ReturnType<typeof getAuthAdmin>>>,id:string){
 const accountId=providerAccountId(auth.projectUrl,id),{db,bucket}=storage();
 await blockAccount(accountId,"deleted");
 const link=await db.prepare("SELECT legacy_owner FROM auth_links WHERE account_id=?").bind(accountId).first<{legacy_owner:string}>();
 if(link)await blockAccount(link.legacy_owner,"deleted");
 const owners:[string,string]=[accountId,link?.legacy_owner??accountId];
 await db.prepare("UPDATE visits SET status='deleting',revision=revision+1 WHERE owner IN (?,?)").bind(...owners).run();
 // Removing every reservation fences conditional writes already in flight.
 const uploads=await db.prepare("SELECT file_key FROM evidence_uploads WHERE owner IN (?,?)").bind(...owners).all<{file_key:string}>();
 for(const upload of uploads.results)await bucket.delete(upload.file_key);
 const visits=await db.prepare("SELECT id,owner FROM visits WHERE owner IN (?,?)").bind(...owners).all<{id:string;owner:string}>();
 for(const visit of visits.results)await cleanupVisitEvidence(visit.owner,visit.id);
 // Include orphaned and superseded evidence, not just current visit files.
 for(const owner of new Set(owners)){
  let cursor:string|undefined;
  do{
   const page=await bucket.list({prefix:`evidence/${owner}/`,limit:100,cursor});
   if(page.objects.length)await bucket.delete(page.objects.map(object=>object.key));
   cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
 }
 await db.prepare("DELETE FROM visits WHERE owner IN (?,?) AND status='deleting'").bind(...owners).run();
 const deleted=await auth.client.auth.admin.deleteUser(id);
 if(deleted.error&&deleted.error.status!==404&&deleted.error.code!=="user_not_found")throw Error("PROVIDER_DELETE_FAILED");
 await db.batch([
  db.prepare("DELETE FROM auth_sessions WHERE account_id IN (?,?)").bind(...owners),
  db.prepare("DELETE FROM auth_account_roles WHERE account_id=?").bind(accountId),
  db.prepare("DELETE FROM auth_account_deletions WHERE account_id=?").bind(accountId),
  db.prepare("DELETE FROM workshop_owners WHERE account_id IN (?,?)").bind(...owners),
  db.prepare("DELETE FROM workshop_claims WHERE owner IN (?,?)").bind(...owners),
  db.prepare("DELETE FROM workshop_changes WHERE owner IN (?,?)").bind(...owners),
  db.prepare("DELETE FROM evidence_uploads WHERE owner IN (?,?)").bind(...owners),
  db.prepare("DELETE FROM auth_links WHERE account_id=?").bind(accountId)
 ]);
}
