import {z} from "zod";
import {storage} from "@/db/storage";
import {moderationAuthority} from "@/lib/auth/moderation-authority";
import {ownerPair,type AppUser} from "@/app/auth";
import {decodeProfile,ensureInitialCatalog,listWorkshops,validateProfile} from "@/db/directory";
import {confirmedPublicationPlace} from "@/db/google-places";
import {workshopIdentityHash} from "@/lib/google-place-identity";
import {googleMapsPlaceUrl} from "@/lib/google-maps-link";
import {businessProfileSchema,claimSchema,editableBusinessProfile,type BusinessRequest,type BusinessDecision,type BusinessState} from "@/lib/business-contract";

export class BusinessError extends Error{constructor(message:string,public status=409){super(message);}}
function activeOwnerSql(owner="?"){return `NOT EXISTS (SELECT 1 FROM auth_account_status WHERE status IN ('inactive','deleted') AND (account_id=${owner} OR account_id IN (SELECT legacy_owner FROM auth_links WHERE account_id=${owner}) OR account_id IN (SELECT account_id FROM auth_links WHERE legacy_owner=${owner})))`;}
const activeOwner=activeOwnerSql();
const activeBindings=(owner:string)=>[owner,owner,owner];
function view(row:Record<string,unknown>,kind:"claim"|"change"):BusinessRequest{
 return {id:String(row.id),workshopId:String(row.workshop_id),workshopName:String(row.workshop_name??row.workshop_id),owner:String(row.owner),status:String(row.status),moderatorNote:String(row.moderator_note),revision:Number(row.revision),createdAt:String(row.created_at),...(kind==="claim"?{evidence:String(row.evidence),evidenceLinks:claimSchema.shape.evidenceLinks.parse(JSON.parse(String(row.evidence_links)))}:{profile:businessProfileSchema.parse(JSON.parse(String(row.profile))),baseUpdatedAt:String(row.base_updated_at)})};
}
function validatedProfile(body:Record<string,unknown>,id:string){
 try{return validateProfile(body,id);}catch(error){throw new BusinessError(error instanceof Error?error.message:"Bitte prüfe die Profilangaben.",400);}
}
function parseCursor(value?:string|null){
 if(!value)return null;
 try{
  if(value.length>512)throw Error();
  return z.object({date:z.string().max(30).refine(value=>Number.isFinite(Date.parse(value))),id:z.string().uuid()}).strict().parse(JSON.parse(atob(value)));
 }catch{throw new BusinessError("Ungültige Seitenangabe.",400);}
}
export async function businessState(user:AppUser,moderation=false,cursors:{claims?:string|null;changes?:string|null}={}):Promise<BusinessState>{
 await ensureInitialCatalog();const db=storage().db,owners=ownerPair(user);
 const read=async(table:"workshop_claims"|"workshop_changes",kind:"claim"|"change",cursorValue?:string|null)=>{
  const cursor=parseCursor(cursorValue),predicate=moderation?"r.status='pending'":"r.owner IN (?,?)";
  const rows=await db.prepare(`SELECT r.*,w.name AS workshop_name FROM ${table} r JOIN workshops w ON w.id=r.workshop_id WHERE ${predicate}${cursor?" AND (r.created_at<? OR (r.created_at=? AND r.id<?))":""} ORDER BY r.created_at DESC,r.id DESC LIMIT 51`).bind(...(moderation?[]:owners),...(cursor?[cursor.date,cursor.date,cursor.id]:[])).all<Record<string,unknown>>();
  const items=rows.results.slice(0,50).map(row=>view(row,kind)),last=items.at(-1);
  return {items,next:rows.results.length>50&&last?btoa(JSON.stringify({date:last.createdAt,id:last.id})):null};
 };
 const owned=moderation?await listWorkshops(true):(await db.prepare("SELECT w.* FROM workshops w JOIN workshop_owners o ON o.workshop_id=w.id WHERE o.account_id IN (?,?) ORDER BY w.name").bind(...owners).all<Record<string,unknown>>()).results.map(decodeProfile);
 const claims=await read("workshop_claims","claim",cursors.claims),changes=await read("workshop_changes","change",cursors.changes);
 return {claims:claims.items,changes:changes.items,workshops:owned,nextClaimCursor:claims.next,nextChangeCursor:changes.next};
}
export async function requestWorkshopClaim(user:AppUser,body:unknown){
 const input=claimSchema.parse(body),db=storage().db;await ensureInitialCatalog();
 const id=crypto.randomUUID();
 const result=await db.prepare(`INSERT INTO workshop_claims (id,workshop_id,owner,evidence,evidence_links,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workshops WHERE id=? AND status='published') AND NOT EXISTS (SELECT 1 FROM workshop_owners WHERE workshop_id=?) AND NOT EXISTS (SELECT 1 FROM workshop_claims WHERE workshop_id=? AND owner IN (?,?) AND status='pending') AND ${activeOwner}`).bind(id,input.workshopId,user.userId,input.evidence,JSON.stringify(input.evidenceLinks),new Date().toISOString(),input.workshopId,input.workshopId,input.workshopId,...ownerPair(user),...activeBindings(user.userId)).run();
 if(!result.meta.changes)throw new BusinessError("Das Profil ist nicht verfügbar, bereits zugeordnet oder dein Antrag wird schon geprüft.");
 return id;
}
export async function requestWorkshopChange(user:AppUser,workshopId:string,body:unknown){
 const fields=businessProfileSchema.parse(body),db=storage().db;await ensureInitialCatalog();
 const current=await db.prepare("SELECT w.*,o.account_id AS business_owner FROM workshops w JOIN workshop_owners o ON o.workshop_id=w.id WHERE w.id=? AND o.account_id IN (?,?)").bind(workshopId,...ownerPair(user)).first<Record<string,unknown>>();
 if(!current)throw new BusinessError("Dieses Profil ist deinem Konto nicht zugeordnet.",403);
 const workshop=decodeProfile(current),validated=validatedProfile({...workshop,...fields},workshopId);
 const profile=businessProfileSchema.parse(editableBusinessProfile(validated)),id=crypto.randomUUID();
 const result=await db.prepare(`INSERT INTO workshop_changes (id,workshop_id,owner,profile,base_updated_at,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workshop_owners WHERE workshop_id=? AND account_id IN (?,?)) AND EXISTS (SELECT 1 FROM workshops WHERE id=? AND updated_at=?) AND NOT EXISTS (SELECT 1 FROM workshop_changes WHERE workshop_id=? AND status='pending') AND ${activeOwner}`).bind(id,workshopId,String(current.business_owner),JSON.stringify(profile),workshop.updatedAt,new Date().toISOString(),workshopId,...ownerPair(user),workshopId,workshop.updatedAt,workshopId,...activeBindings(user.userId)).run();
 if(!result.meta.changes)throw new BusinessError("Für dieses Profil liegt bereits ein Entwurf vor oder die Zuordnung wurde geändert.");
 return id;
}
export async function decideClaim(admin:AppUser,id:string,revision:number,decision:BusinessDecision,note:string){
 const db=storage().db,now=new Date().toISOString(),actor=moderationAuthority(admin);
 if(decision==="rejected"){
  const result=await db.prepare(`UPDATE workshop_claims SET status='rejected',moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1 WHERE id=? AND revision=? AND status='pending' AND ${actor.sql}`).bind(note,now,admin.userId,id,revision,...actor.values).run();
  if(!result.meta.changes)throw new BusinessError("Der Antrag wurde geändert oder du bist nicht mehr zur Freigabe berechtigt.");return;
 }
 const results=await db.batch([
  db.prepare(`INSERT INTO workshop_owners (workshop_id,account_id,claim_id,confirmed_at,confirmed_by) SELECT workshop_id,owner,id,?,? FROM workshop_claims WHERE id=? AND revision=? AND status='pending' AND ${activeOwnerSql("workshop_claims.owner")} AND ${actor.sql} ON CONFLICT(workshop_id) DO NOTHING`).bind(now,admin.userId,id,revision,...actor.values),
  db.prepare("UPDATE workshop_claims SET status='approved',moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1 WHERE id=? AND revision=? AND status='pending' AND EXISTS (SELECT 1 FROM workshop_owners WHERE claim_id=workshop_claims.id)").bind(note,now,admin.userId,id,revision),
  db.prepare("UPDATE workshop_claims SET status='rejected',moderator_note='Ein anderer Übernahme-Antrag wurde bestätigt.',moderated_at=?,moderated_by=?,revision=revision+1 WHERE status='pending' AND id<>? AND workshop_id IN (SELECT workshop_id FROM workshop_owners WHERE claim_id=?)").bind(now,admin.userId,id,id)
 ]);
 if(!results[0].meta.changes)throw new BusinessError("Das Profil ist bereits zugeordnet, das Konto ist gesperrt oder der Antrag wurde geändert.");
}
export async function decideChange(admin:AppUser,id:string,revision:number,decision:BusinessDecision,note:string){
 const db=storage().db,actor=moderationAuthority(admin),now=new Date().toISOString();
 if(decision==="rejected"){
  const result=await db.prepare(`UPDATE workshop_changes SET status='rejected',moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1 WHERE id=? AND revision=? AND status='pending' AND ${actor.sql}`).bind(note,now,admin.userId,id,revision,...actor.values).run();
  if(!result.meta.changes)throw new BusinessError("Der Entwurf wurde bereits geändert.");return;
 }
 const change=await db.prepare("SELECT * FROM workshop_changes WHERE id=? AND revision=? AND status='pending'").bind(id,revision).first<Record<string,unknown>>();
 if(!change)throw new BusinessError("Der Entwurf wurde bereits entschieden.");
 const existing=(await listWorkshops(true)).find(workshop=>workshop.id===change.workshop_id);
 if(!existing||existing.updatedAt!==change.base_updated_at)throw new BusinessError("Die freigegebenen Angaben wurden inzwischen geändert. Bitte lehne diesen Entwurf ab und fordere einen neuen an.");
 const fields=businessProfileSchema.parse(JSON.parse(String(change.profile))),profile=validatedProfile({...existing,...fields},existing.id);
 const placeId=profile.status==="published"?await confirmedPublicationPlace(profile,existing,false):null;
 if(profile.status==="published"&&!placeId)throw new BusinessError("Für diese Kontaktdaten fehlt eine eindeutige bestätigte Google-Zuordnung. Der bisherige öffentliche Stand bleibt erhalten.",422);
 profile.updatedAt=new Date(Math.max(Date.now(),Date.parse(existing.updatedAt)+1)).toISOString();
 const operation=crypto.randomUUID();
 const availablePlace=placeId?" AND NOT EXISTS (SELECT 1 FROM workshop_google_places WHERE place_id=? AND workshop_id<>?)":"";
 // Reserve this exact decision inside the same transaction as publication.
 // The token prevents later statements from applying a concurrent decision's
 // values when the first optimistic write did not win.
 const statements=[db.prepare(`UPDATE workshop_changes SET status='approved',moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1,decision_token=? WHERE id=? AND revision=? AND status='pending' AND EXISTS (SELECT 1 FROM workshops WHERE id=workshop_changes.workshop_id AND updated_at=?) AND EXISTS (SELECT 1 FROM workshop_owners WHERE workshop_id=workshop_changes.workshop_id AND account_id=workshop_changes.owner) AND ${activeOwnerSql("workshop_changes.owner")} AND ${actor.sql}${availablePlace}`).bind(note,now,admin.userId,operation,id,revision,existing.updatedAt,...actor.values,...(placeId?[placeId,existing.id]:[])),
  db.prepare("UPDATE workshops SET phone=?,phone_note=?,whatsapp=?,services=?,service_details=?,description=?,updated_at=? WHERE id=? AND updated_at=? AND EXISTS (SELECT 1 FROM workshop_changes WHERE id=? AND decision_token=? AND status='approved')").bind(fields.phone,fields.phoneNote,fields.whatsapp,JSON.stringify(fields.services),JSON.stringify(fields.serviceDetails),fields.description,profile.updatedAt,existing.id,existing.updatedAt,id,operation)
 ];
 if(placeId){
  const hash=await workshopIdentityHash(profile),checkedAt=Date.now();
  statements.push(db.prepare("INSERT INTO workshop_google_places (workshop_id,place_id,profile_hash,checked_at,retry_after) SELECT id,?,?,?,? FROM workshops WHERE id=? AND updated_at=? AND EXISTS (SELECT 1 FROM workshop_changes WHERE id=? AND decision_token=?) ON CONFLICT(workshop_id) DO UPDATE SET place_id=excluded.place_id,profile_hash=excluded.profile_hash,checked_at=excluded.checked_at,retry_after=excluded.retry_after").bind(placeId,hash,checkedAt,checkedAt+365*86400000,existing.id,profile.updatedAt,id,operation));
  statements.push(db.prepare("UPDATE workshop_google_ratings SET maps_url=?,checked_at=? WHERE workshop_id=? AND EXISTS (SELECT 1 FROM workshops WHERE id=? AND updated_at=?) AND EXISTS (SELECT 1 FROM workshop_changes WHERE id=? AND decision_token=?)").bind(googleMapsPlaceUrl(placeId,`${profile.name} ${profile.address}`),profile.updatedAt,existing.id,existing.id,profile.updatedAt,id,operation));
 }
 const results=await db.batch(statements);if(!results[0].meta.changes)throw new BusinessError("Die Zuordnung, das Profil oder deine Berechtigung wurde inzwischen geändert.");
}
