import type {SqlDatabase,SqlStatement} from "@/lib/runtime/contracts";
import type {WorkshopCatalogue} from "@/lib/workshop-source";
import type {WorkshopContact} from "@/lib/workshop-contacts";
import {profileColumns,profileValues} from "./workshop-profile-values";
import {workshopIdentityHash} from "@/lib/google-place-identity";
import {retiredWorkshopIds,workshopRetirementDate} from "@/lib/workshop-retirement";
export async function catalogueImportStatements(db:SqlDatabase,catalogue:WorkshopCatalogue,contacts:WorkshopContact[]=[]){
 const profiles=catalogue.workshops,googleSnapshots=catalogue.workshops.flatMap(w=>w.google.snapshot?[{workshopId:w.id,...w.google.snapshot}]:[]),statements:SqlStatement[]=[];
 // Fresh installations also retain deletion markers. Existing records are
 // removed separately by the guarded operation, after checking private links.
 for(const id of retiredWorkshopIds())statements.push(db.prepare("INSERT OR IGNORE INTO catalog_state(key,value) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id=?)").bind(`workshop-retired:${id}`,workshopRetirementDate,id));
 const chunkSize=Math.floor(95/profileColumns.length);
 for(let i=0;i<profiles.length;i+=chunkSize){const chunk=profiles.slice(i,i+chunkSize);const sql=`INSERT INTO workshops (${profileColumns.join(",")}) VALUES ${chunk.map(()=>`(${profileColumns.map(()=>"?").join(",")})`).join(",")} ON CONFLICT(id) DO UPDATE SET ${profileColumns.slice(1).map(column=>`${column}=excluded.${column}`).join(",")} WHERE workshops.updated_at < excluded.updated_at`;statements.push(db.prepare(sql).bind(...chunk.flatMap(profileValues)));}
 // Google snapshots never enter the visit aggregate or overwrite the workshop's edited profile.
 const googleColumns=["workshop_id","rating","review_count","maps_url","source_url","source_label","checked_at","source_updated_at"];
 const googleChunkSize=Math.floor(95/googleColumns.length);
 for(let i=0;i<googleSnapshots.length;i+=googleChunkSize){
  const chunk=googleSnapshots.slice(i,i+googleChunkSize);
  const sql=`INSERT INTO workshop_google_ratings (${googleColumns.join(",")}) VALUES ${chunk.map(()=>`(${googleColumns.map(()=>"?").join(",")})`).join(",")} ON CONFLICT(workshop_id) DO UPDATE SET ${googleColumns.slice(1).map(column=>`${column}=excluded.${column}`).join(",")} WHERE workshop_google_ratings.checked_at < excluded.checked_at`;
  statements.push(db.prepare(sql).bind(...chunk.flatMap(g=>[g.workshopId,g.rating,g.count,g.mapsUrl,g.sourceUrl,g.sourceLabel,g.checkedAt,g.sourceUpdatedAt])));
 }
 for(const w of catalogue.workshops){
  if(!w.google.placeId||!w.google.matchedAt)continue;
  const checkedAt=Date.parse(w.google.matchedAt),hash=await workshopIdentityHash(w);
  statements.push(db.prepare("INSERT INTO workshop_google_places (workshop_id,place_id,profile_hash,checked_at,retry_after) VALUES (?,?,?,?,?) ON CONFLICT(workshop_id) DO UPDATE SET place_id=excluded.place_id,profile_hash=excluded.profile_hash,checked_at=excluded.checked_at,retry_after=excluded.retry_after WHERE workshop_google_places.checked_at < excluded.checked_at").bind(w.id,w.google.placeId,hash,checkedAt,checkedAt+365*86400000));
 }
 for(const contact of contacts){
  // Match against the live profile as well: a newer owner edit must never be
  // associated with contact evidence researched for a different identity.
  statements.push(db.prepare(`INSERT INTO workshop_contact_details
   (workshop_id,email,website,source_urls,checked_at,matched_name,matched_phone,matched_city,email_verification)
   SELECT id,?,?,?,?,?,?,?,? FROM workshops WHERE id=? AND name=? AND phone=? AND city=? AND status='published'
   ON CONFLICT(workshop_id) DO UPDATE SET email=excluded.email,website=excluded.website,source_urls=excluded.source_urls,checked_at=excluded.checked_at,
    matched_name=excluded.matched_name,matched_phone=excluded.matched_phone,matched_city=excluded.matched_city,email_verification=excluded.email_verification
   WHERE workshop_contact_details.checked_at < excluded.checked_at`)
   .bind(contact.email,contact.website,JSON.stringify(contact.sourceUrls),contact.checkedAt,contact.matchedName,contact.matchedPhone,contact.matchedCity,contact.emailVerification,contact.workshopId,contact.matchedName,contact.matchedPhone,contact.matchedCity));
 }
 return statements;
}
export async function catalogueImportKey(catalogue:WorkshopCatalogue,contacts:WorkshopContact[]=[]){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(contacts.length?{catalogue,contacts}:catalogue)));return "workshop-source:"+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");}
export const catalogueCompletionSql="INSERT OR IGNORE INTO catalog_state (key,value) VALUES (?,?)";
