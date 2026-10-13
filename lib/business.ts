import {validateEvidenceFile} from "@/lib/evidence-file";
import {ValidationError} from "@/lib/validation-error";
import {storage} from "@/db/storage";
import {moderationAuthority} from "@/lib/auth/moderation-authority";
import {ownerPair,type AppUser} from "@/app/auth";
import {decodeProfile,ensureInitialCatalog,listWorkshops,validateProfile} from "@/db/directory";
import {confirmedPublicationPlace} from "@/db/google-places";
import {workshopIdentityHash} from "@/lib/google-place-identity";
import {googleMapsPlaceUrl} from "@/lib/google-maps-link";
import {businessProfileSchema,claimSchema,claimDocumentsError,type StoredClaimDocument,editableBusinessProfile,type BusinessDecision} from "@/lib/business-contract";

import {BusinessError} from "./business-error";
export {BusinessError} from "./business-error";
export {businessState} from "./business-read";
function activeOwnerSql(owner="?"){return `NOT EXISTS (SELECT 1 FROM auth_account_status WHERE status IN ('inactive','deleted') AND (account_id=${owner} OR account_id IN (SELECT legacy_owner FROM auth_links WHERE account_id=${owner}) OR account_id IN (SELECT account_id FROM auth_links WHERE legacy_owner=${owner})))`;}
const activeOwner=activeOwnerSql();
const activeBindings=(owner:string)=>[owner,owner,owner];
function validatedProfile(body:Record<string,unknown>,id:string){
 try{return validateProfile(body,id);}catch(error){throw new BusinessError(error instanceof ValidationError?error.message:"Bitte prüfe die Profilangaben.",400,error instanceof ValidationError?error.code:"workshop_invalid_profile");}
}
export async function requestWorkshopClaim(user:AppUser,body:unknown,files:File[]=[]){
 const input=claimSchema.parse(body),selectionError=claimDocumentsError(files);
 if(selectionError)throw new BusinessError("Bitte prüfe die Dokumente.",selectionError==="file_too_large"||selectionError==="business_documents_too_large"?413:400,selectionError);
 // Validate the entire bounded selection before writing any private objects.
 const validated=[];for(const file of files)validated.push(await validateEvidenceFile(file));
 const {db,bucket}=storage();await ensureInitialCatalog();
 const id=crypto.randomUUID(),documents:StoredClaimDocument[]=[],keys:string[]=[];
 try{
  for(const document of validated){
   const documentId=crypto.randomUUID(),key=`evidence/${user.userId}/claims/${id}/${documentId}`;keys.push(key);
   const tracked=await db.prepare(`INSERT INTO evidence_uploads (file_key,owner) SELECT ?,? WHERE ${activeOwner}`).bind(key,user.userId,...activeBindings(user.userId)).run();
   if(!tracked.meta.changes)throw new BusinessError("Dein Konto ist gesperrt.",401,"account_blocked");
   // Account deletion removes the reservation, fencing a delayed private payload.
   const reservation=await bucket.put(key,null,{customMetadata:{kind:"upload-reservation"}});
   const permitted=await db.prepare(`SELECT file_key FROM evidence_uploads WHERE file_key=? AND ${activeOwner}`).bind(key,...activeBindings(user.userId)).first();
   if(!permitted)throw new BusinessError("Dein Konto ist gesperrt.",401,"account_blocked");
   const uploaded=await bucket.put(key,document.bytes,{httpMetadata:{contentType:document.fileType},onlyIf:{etagMatches:reservation.etag}});
   if(!uploaded)throw new BusinessError("Der Upload wurde inzwischen abgebrochen. Bitte versuche es erneut.",409,"business_claim_conflict");
   documents.push({id:documentId,fileKey:key,fileName:document.fileName,fileType:document.fileType as StoredClaimDocument["fileType"]});
  }
  const first=documents[0];
  const result=await db.prepare(`INSERT INTO workshop_claims (id,workshop_id,owner,evidence,evidence_links,file_key,file_name,file_type,documents,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workshops WHERE id=? AND status='published') AND NOT EXISTS (SELECT 1 FROM workshop_owners WHERE workshop_id=?) AND NOT EXISTS (SELECT 1 FROM workshop_claims WHERE workshop_id=? AND owner IN (?,?) AND status='pending') AND ${activeOwner}`).bind(id,input.workshopId,user.userId,input.evidence,JSON.stringify(input.evidenceLinks),first.fileKey,first.fileName,first.fileType,JSON.stringify(documents),new Date().toISOString(),input.workshopId,input.workshopId,input.workshopId,...ownerPair(user),...activeBindings(user.userId)).run();
  if(!result.meta.changes)throw new BusinessError("Das Profil ist nicht verfügbar, bereits zugeordnet oder dein Antrag wird schon geprüft.",409,"business_claim_unavailable");
  return id;
 }finally{
  for(const key of keys)try{
   const referenced=await db.prepare("SELECT id FROM workshop_claims WHERE id=? AND (file_key=? OR EXISTS (SELECT 1 FROM json_each(documents) WHERE json_extract(value,'$.fileKey')=?))").bind(id,key,key).first();
   if(!referenced)await bucket.delete(key);
   await db.prepare("DELETE FROM evidence_uploads WHERE file_key=?").bind(key).run();
  }catch{console.error("claim-upload-cleanup-pending");}
 }
}
export async function requestWorkshopChange(user:AppUser,workshopId:string,body:unknown){
 const fields=businessProfileSchema.parse(body),db=storage().db;await ensureInitialCatalog();
 const current=await db.prepare("SELECT w.*,o.account_id AS business_owner FROM workshops w JOIN workshop_owners o ON o.workshop_id=w.id WHERE w.id=? AND o.account_id IN (?,?)").bind(workshopId,...ownerPair(user)).first<Record<string,unknown>>();
 if(!current)throw new BusinessError("Dieses Profil ist deinem Konto nicht zugeordnet.",403,"business_not_owner");
 const workshop=decodeProfile(current),validated=validatedProfile({...workshop,...fields},workshopId);
 const profile=businessProfileSchema.parse({...editableBusinessProfile(validated),openingHours:fields.openingHours}),id=crypto.randomUUID();
 const result=await db.prepare(`INSERT INTO workshop_changes (id,workshop_id,owner,profile,base_updated_at,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workshop_owners WHERE workshop_id=? AND account_id IN (?,?)) AND EXISTS (SELECT 1 FROM workshops WHERE id=? AND updated_at=?) AND NOT EXISTS (SELECT 1 FROM workshop_changes WHERE workshop_id=? AND status='pending') AND ${activeOwner}`).bind(id,workshopId,String(current.business_owner),JSON.stringify(profile),workshop.updatedAt,new Date().toISOString(),workshopId,...ownerPair(user),workshopId,workshop.updatedAt,workshopId,...activeBindings(user.userId)).run();
 if(!result.meta.changes)throw new BusinessError("Für dieses Profil liegt bereits ein Entwurf vor oder die Zuordnung wurde geändert.",409,"business_draft_conflict");
 return id;
}
export async function decideClaim(admin:AppUser,id:string,revision:number,decision:BusinessDecision,note:string){
 const db=storage().db,now=new Date().toISOString(),actor=moderationAuthority(admin);
 if(decision==="rejected"){
  const result=await db.prepare(`UPDATE workshop_claims SET status='rejected',moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1 WHERE id=? AND revision=? AND status='pending' AND ${actor.sql}`).bind(note,now,admin.userId,id,revision,...actor.values).run();
  if(!result.meta.changes)throw new BusinessError("Der Antrag wurde geändert oder du bist nicht mehr zur Freigabe berechtigt.",409,"business_claim_conflict");return;
 }
 const results=await db.batch([
  db.prepare(`INSERT INTO workshop_owners (workshop_id,account_id,claim_id,confirmed_at,confirmed_by) SELECT workshop_id,owner,id,?,? FROM workshop_claims WHERE id=? AND revision=? AND status='pending' AND ${activeOwnerSql("workshop_claims.owner")} AND ${actor.sql} ON CONFLICT(workshop_id) DO NOTHING`).bind(now,admin.userId,id,revision,...actor.values),
  db.prepare("UPDATE workshop_claims SET status='approved',moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1 WHERE id=? AND revision=? AND status='pending' AND EXISTS (SELECT 1 FROM workshop_owners WHERE claim_id=workshop_claims.id)").bind(note,now,admin.userId,id,revision),
  db.prepare("UPDATE workshop_claims SET status='rejected',moderator_note='Ein anderer Übernahme-Antrag wurde bestätigt.',moderated_at=?,moderated_by=?,revision=revision+1 WHERE status='pending' AND id<>? AND workshop_id IN (SELECT workshop_id FROM workshop_owners WHERE claim_id=?)").bind(now,admin.userId,id,id)
 ]);
 if(!results[0].meta.changes)throw new BusinessError("Das Profil ist bereits zugeordnet, das Konto ist gesperrt oder der Antrag wurde geändert.",409,"business_assignment_conflict");
}
export async function decideChange(admin:AppUser,id:string,revision:number,decision:BusinessDecision,note:string){
 const db=storage().db,actor=moderationAuthority(admin),now=new Date().toISOString();
 if(decision==="rejected"){
  const result=await db.prepare(`UPDATE workshop_changes SET status='rejected',moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1 WHERE id=? AND revision=? AND status='pending' AND ${actor.sql}`).bind(note,now,admin.userId,id,revision,...actor.values).run();
  if(!result.meta.changes)throw new BusinessError("Der Entwurf wurde bereits geändert.",409,"business_draft_changed");return;
 }
 const change=await db.prepare("SELECT * FROM workshop_changes WHERE id=? AND revision=? AND status='pending'").bind(id,revision).first<Record<string,unknown>>();
 if(!change)throw new BusinessError("Der Entwurf wurde bereits entschieden.",409,"business_draft_decided");
 const existing=(await listWorkshops(true)).find(workshop=>workshop.id===change.workshop_id);
 if(!existing||existing.updatedAt!==change.base_updated_at)throw new BusinessError("Die freigegebenen Angaben wurden inzwischen geändert. Bitte lehne diesen Entwurf ab und fordere einen neuen an.",409,"business_profile_changed");
 const fields=businessProfileSchema.parse(JSON.parse(String(change.profile))),profile=validatedProfile({...existing,...fields},existing.id);
 const placeId=profile.status==="published"?await confirmedPublicationPlace(profile,existing,false):null;
 if(profile.status==="published"&&!placeId)throw new BusinessError("Für diese Kontaktdaten fehlt eine eindeutige bestätigte Google-Zuordnung. Der bisherige öffentliche Stand bleibt erhalten.",422,"business_google_required");
 profile.updatedAt=new Date(Math.max(Date.now(),Date.parse(existing.updatedAt)+1)).toISOString();
 const operation=crypto.randomUUID();
 const availablePlace=placeId?" AND NOT EXISTS (SELECT 1 FROM workshop_google_places WHERE place_id=? AND workshop_id<>?)":"";
 // Reserve this exact decision inside the same transaction as publication.
 // The token prevents later statements from applying a concurrent decision's
 // values when the first optimistic write did not win.
 const statements=[db.prepare(`UPDATE workshop_changes SET status='approved',moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1,decision_token=? WHERE id=? AND revision=? AND status='pending' AND EXISTS (SELECT 1 FROM workshops WHERE id=workshop_changes.workshop_id AND updated_at=?) AND EXISTS (SELECT 1 FROM workshop_owners WHERE workshop_id=workshop_changes.workshop_id AND account_id=workshop_changes.owner) AND ${activeOwnerSql("workshop_changes.owner")} AND ${actor.sql}${availablePlace}`).bind(note,now,admin.userId,operation,id,revision,existing.updatedAt,...actor.values,...(placeId?[placeId,existing.id]:[])),
  db.prepare("UPDATE workshops SET phone=?,phone_note=?,whatsapp=?,services=?,service_details=?,description=?,updated_at=?,opening_hours=CASE WHEN ? THEN ? ELSE opening_hours END,opening_hours_confirmed_at=CASE WHEN ? THEN ? ELSE opening_hours_confirmed_at END WHERE id=? AND updated_at=? AND EXISTS (SELECT 1 FROM workshop_changes WHERE id=? AND decision_token=? AND status='approved')").bind(fields.phone,fields.phoneNote,fields.whatsapp,JSON.stringify(fields.services),JSON.stringify(fields.serviceDetails),fields.description,profile.updatedAt,fields.openingHours!==undefined?1:0,fields.openingHours==null?null:JSON.stringify(fields.openingHours),fields.openingHours!==undefined?1:0,fields.openingHours==null?null:String(change.created_at),existing.id,existing.updatedAt,id,operation)
 ];
 if(placeId){
  const hash=await workshopIdentityHash(profile),checkedAt=Date.now();
  statements.push(db.prepare("INSERT INTO workshop_google_places (workshop_id,place_id,profile_hash,checked_at,retry_after) SELECT id,?,?,?,? FROM workshops WHERE id=? AND updated_at=? AND EXISTS (SELECT 1 FROM workshop_changes WHERE id=? AND decision_token=?) ON CONFLICT(workshop_id) DO UPDATE SET place_id=excluded.place_id,profile_hash=excluded.profile_hash,checked_at=excluded.checked_at,retry_after=excluded.retry_after").bind(placeId,hash,checkedAt,checkedAt+365*86400000,existing.id,profile.updatedAt,id,operation));
  statements.push(db.prepare("UPDATE workshop_google_ratings SET maps_url=?,checked_at=? WHERE workshop_id=? AND EXISTS (SELECT 1 FROM workshops WHERE id=? AND updated_at=?) AND EXISTS (SELECT 1 FROM workshop_changes WHERE id=? AND decision_token=?)").bind(googleMapsPlaceUrl(placeId,`${profile.name} ${profile.address}`),profile.updatedAt,existing.id,existing.id,profile.updatedAt,id,operation));
 }
 const results=await db.batch(statements);if(!results[0].meta.changes)throw new BusinessError("Die Zuordnung, das Profil oder deine Berechtigung wurde inzwischen geändert.",409,"business_authority_changed");
}
