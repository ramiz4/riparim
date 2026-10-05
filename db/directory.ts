import { storage } from "./storage";
import canonical from "@/data/workshops.json";
import {validateWorkshopCatalogue,workshopCatalogueSchema} from "@/lib/workshop-source";
import {workshopIdentityHash} from "@/lib/google-place-identity";
import {workshopScopeExclusion} from "@/lib/workshop-scope";
import {workshopRetired,retiredWorkshopIds,workshopRetirementDate} from "@/lib/workshop-retirement";
import {services,cities,type Workshop,type Source,type GoogleRating} from "@/lib/workshops";
export const profileColumns=["id","name","city","address","phone","phone_note","whatsapp","brands","services","service_details","languages","specialty","description","lat","lng","sources","checked_at","status","updated_at"];
export type ProfileInput=Omit<Workshop,"initials"|"color"|"rating"|"count"|"googleRating">;
// Workers have no reliable wall clock during module initialization.
const catalogue=workshopCatalogueSchema.parse(canonical);
const curated=catalogue.workshops.map(({google,...profile})=>profile);
const googleSnapshots=catalogue.workshops.flatMap(w=>w.google.snapshot?[{workshopId:w.id,...w.google.snapshot}]:[]);
let seedKey:Promise<string>|undefined;
export function catalogueSeedKey(){return seedKey??=crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(catalogue))).then(digest=>"workshop-source:"+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join(""));}
function parseArray<T>(value:unknown):T[]{if(typeof value!=="string")return [];try{const a=JSON.parse(value);return Array.isArray(a)?a:[];}catch{return [];}}
function decodeGoogleRating(row:Record<string,unknown>):GoogleRating|null{
 if(!row.google_workshop_id)return null;
 return {rating:row.google_rating===null||row.google_rating===undefined?null:Number(row.google_rating),count:row.google_review_count===null||row.google_review_count===undefined?null:Number(row.google_review_count),mapsUrl:String(row.google_maps_url),sourceUrl:row.google_source_url?String(row.google_source_url):null,sourceLabel:row.google_source_label?String(row.google_source_label):null,checkedAt:String(row.google_checked_at),sourceUpdatedAt:row.google_source_updated_at?String(row.google_source_updated_at):null};
}
export function decodeProfile(row:Record<string,unknown>):Workshop{return {id:String(row.id),name:String(row.name),city:String(row.city),address:String(row.address),phone:String(row.phone),phoneNote:String(row.phone_note??""),whatsapp:String(row.whatsapp??""),brands:parseArray<string>(row.brands),services:parseArray<string>(row.services),serviceDetails:parseArray<string>(row.service_details),languages:parseArray<string>(row.languages),specialty:String(row.specialty),description:String(row.description),lat:row.lat===null?null:Number(row.lat),lng:row.lng===null?null:Number(row.lng),sources:parseArray<Source>(row.sources),checkedAt:String(row.checked_at),status:row.status==="published"?"published":"draft",updatedAt:String(row.updated_at),initials:String(row.name).split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase(),color:["green","blue","orange","purple"][String(row.id).length%4],rating:row.rating===null||row.rating===undefined?null:Number(row.rating),count:Number(row.count??0),googleRating:decodeGoogleRating(row)};}
export function profileValues(w:ProfileInput){return [w.id,w.name,w.city,w.address,w.phone,w.phoneNote,w.whatsapp,JSON.stringify(w.brands),JSON.stringify(w.services),JSON.stringify(w.serviceDetails),JSON.stringify(w.languages),w.specialty,w.description,w.lat===null?null:String(w.lat),w.lng===null?null:String(w.lng),JSON.stringify(w.sources),w.checkedAt,w.status,w.updatedAt];}
// Canonical JSON is imported independently from immutable schema migrations.
export async function ensureInitialCatalog(){
 const {db}=storage();if(!curated.length)return;
 validateWorkshopCatalogue(catalogue);
 const key=await catalogueSeedKey();
 const marker=await db.prepare("SELECT value FROM catalog_state WHERE key=?").bind(key).first();if(marker)return;
 const profiles=curated as ProfileInput[],statements=[];
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
 // Bounded, repeatable batches also support large imports; the completion marker is last.
 for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50));
 await db.prepare("INSERT OR IGNORE INTO catalog_state (key,value) VALUES (?,?)").bind(key,new Date().toISOString()).run();
}
export async function listWorkshops(includeDrafts=false){await ensureInitialCatalog();const {db}=storage();const result=await db.prepare(`SELECT w.*, ROUND(AVG(v.rating),1) AS rating, COUNT(v.id) AS count, g.workshop_id AS google_workshop_id, g.rating AS google_rating, g.review_count AS google_review_count, g.maps_url AS google_maps_url, g.source_url AS google_source_url, g.source_label AS google_source_label, g.checked_at AS google_checked_at, g.source_updated_at AS google_source_updated_at FROM workshops w LEFT JOIN visits v ON v.workshop=w.id AND v.status='published' LEFT JOIN workshop_google_ratings g ON g.workshop_id=w.id ${includeDrafts?"":"WHERE w.status='published'"} GROUP BY w.id ORDER BY w.name COLLATE NOCASE`).all<Record<string,unknown>>();return result.results.map(decodeProfile);}
export async function publishedWorkshop(id:string){await ensureInitialCatalog();return storage().db.prepare("SELECT id FROM workshops WHERE id=? AND status='published'").bind(id).first();}
export function validateProfile(body:Record<string,unknown>,id:string):ProfileInput{
 if(workshopRetired(id))throw Error("Diese Werkstattkennung wurde entfernt und darf nicht erneut verwendet werden.");
 const text=(key:string,max:number)=>String(body[key]??"").trim().slice(0,max),arrays=(key:string,max=30)=>Array.isArray(body[key])?[...new Set((body[key] as unknown[]).map(String).map(v=>v.trim().slice(0,200)).filter(Boolean))].slice(0,max):[];
 const name=text("name",120),city=text("city",80),address=text("address",250),phone=text("phone",30).replace(/[ ()-]/g,""),whatsapp=text("whatsapp",30).replace(/[ ()-]/g,"");const brandList=arrays("brands"),serviceList=arrays("services"),serviceDetails=arrays("serviceDetails"),languages=arrays("languages",8),description=text("description",2000),specialty=text("specialty",100),checkedAt=text("checkedAt",10),status=body.status==="published"?"published":"draft";
 const inputSources=Array.isArray(body.sources)?body.sources:[];const sources:Source[]=inputSources.slice(0,8).map(item=>{if(!item||typeof item!=="object")throw Error("Bitte ergänze gültige Quellen.");const r=item as Record<string,unknown>;const u=new URL(String(r.url));if(u.protocol!=="https:"||u.username||u.password)throw Error("Quellen müssen HTTPS-Links ohne Zugangsdaten sein.");const directorySource=r.kind==="directory"||/(^|\.)(cybo\.com|gjirafa\.biz|mapcarta\.com)$/.test(u.hostname);return {url:u.href,title:String(r.title??u.hostname).slice(0,150),...(directorySource?{kind:"directory" as const}:r.kind==="official"?{kind:"official" as const}:{})};});
 const today=new Date().toISOString().slice(0,10);if(name.length<3||!cities.slice(1).includes(city)||address.length<5||!/^\+[1-9]\d{7,14}$/.test(phone)||!serviceList.length||!serviceDetails.length||serviceList.some(v=>!services.slice(1).includes(v))||description.length<20||specialty.length<3||!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)||!Number.isFinite(Date.parse(checkedAt))||new Date(checkedAt).toISOString().slice(0,10)!==checkedAt||checkedAt>today)throw Error("Bitte prüfe Name, Ort, Adresse, Telefonnummer, Marke, Leistungen, Beschreibung und Prüfdatum.");
 if(whatsapp&&!/^\+[1-9]\d{7,14}$/.test(whatsapp))throw Error("Bitte ergänze WhatsApp als internationale Telefonnummer oder lasse das Feld leer.");if(status==="published"&&!sources.length)throw Error("Ein veröffentlichtes Profil braucht mindestens eine nachvollziehbare Quelle.");
 if(status==="published"&&workshopScopeExclusion({id,name}))throw Error("Riparim veröffentlicht Pkw-Werkstätten. "+workshopScopeExclusion({id,name})+" Bitte als Entwurf speichern.");
 const lat=body.lat===null||body.lat===undefined||body.lat===""?null:Number(body.lat),lng=body.lng===null||body.lng===undefined||body.lng===""?null:Number(body.lng);if((lat===null)!==(lng===null)||(lat!==null&&(!Number.isFinite(lat)||lat<41.8||lat>43.3||!Number.isFinite(lng)||lng!<19.8||lng!>21.9)))throw Error("Bitte ergänze gültige Koordinaten in Kosovo oder lasse beide Felder leer.");
 return {id,name,city,address,phone,phoneNote:text("phoneNote",150),whatsapp,brands:brandList,services:serviceList,serviceDetails,languages,specialty,description,lat,lng,sources,checkedAt,status,updatedAt:new Date().toISOString()};
}
