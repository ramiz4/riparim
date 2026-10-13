import {ValidationError} from "@/lib/validation-error";
import { storage } from "./storage";
import canonical from "@/data/workshops.json";
import {validateWorkshopCatalogue,type WorkshopCatalogue} from "@/lib/workshop-source";
import {catalogueImportStatements,catalogueImportKey,catalogueCompletionSql} from "./catalogue-import";
import {workshopScopeExclusion} from "@/lib/workshop-scope";
import {workshopRetired} from "@/lib/workshop-retirement";
import {services,cities,type Workshop,type Source} from "@/lib/workshops";
export {profileColumns,profileValues} from "./workshop-profile-values";
export type ProfileInput=Omit<Workshop,"initials"|"color"|"rating"|"count"|"googleRating">;
// Workers have no reliable wall clock during module initialization.
// Release CI validates this immutable source; avoid reparsing it in every isolate.
const catalogue=canonical as WorkshopCatalogue;
let seedKey:Promise<string>|undefined;
export function catalogueSeedKey(){return seedKey??=catalogueImportKey(catalogue); }
export {decodeProfile} from "./workshop-record";
import {decodeProfile} from "./workshop-record";
// Canonical JSON is imported independently from immutable schema migrations.
export async function ensureInitialCatalog(){
 const {db}=storage();if(!catalogue.workshops.length)return;
 const key=await catalogueSeedKey();
 const marker=await db.prepare("SELECT value FROM catalog_state WHERE key=?").bind(key).first();if(marker)return;
 validateWorkshopCatalogue(catalogue);
 const statements=await catalogueImportStatements(db,catalogue);
 // Bounded, repeatable batches also support large imports; the completion marker is last.
 for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50));
 await db.prepare(catalogueCompletionSql).bind(key,new Date().toISOString()).run();
}
export async function listWorkshops(includeDrafts=false){await ensureInitialCatalog();const {db}=storage();const result=await db.prepare(`SELECT w.*, CASE WHEN h.suppressed=0 THEN h.opening_hours END AS imported_opening_hours, ROUND(AVG(v.rating),1) AS rating, COUNT(v.id) AS count, g.workshop_id AS google_workshop_id, g.rating AS google_rating, g.review_count AS google_review_count, g.maps_url AS google_maps_url, g.source_url AS google_source_url, g.source_label AS google_source_label, g.checked_at AS google_checked_at, g.source_updated_at AS google_source_updated_at FROM workshops w LEFT JOIN workshop_opening_hours_imports h ON h.workshop_id=w.id LEFT JOIN visits v ON v.workshop=w.id AND v.status='published' LEFT JOIN workshop_google_ratings g ON g.workshop_id=w.id ${includeDrafts?"":"WHERE w.status='published'"} GROUP BY w.id ORDER BY w.name COLLATE NOCASE`).all<Record<string,unknown>>();return result.results.map(decodeProfile);}
export async function publishedWorkshop(id:string){await ensureInitialCatalog();return storage().db.prepare("SELECT id FROM workshops WHERE id=? AND status='published'").bind(id).first();}
export function validateProfile(body:Record<string,unknown>,id:string):ProfileInput{
 if(workshopRetired(id))throw new ValidationError("workshop_retired","Diese Werkstattkennung wurde entfernt und darf nicht erneut verwendet werden.");
 const text=(key:string,max:number)=>String(body[key]??"").trim().slice(0,max),arrays=(key:string,max=30)=>Array.isArray(body[key])?[...new Set((body[key] as unknown[]).map(String).map(v=>v.trim().slice(0,200)).filter(Boolean))].slice(0,max):[];
 const name=text("name",120),city=text("city",80),address=text("address",250),phone=text("phone",30).replace(/[ ()-]/g,""),whatsapp=text("whatsapp",30).replace(/[ ()-]/g,"");const brandList=arrays("brands"),serviceList=arrays("services"),serviceDetails=arrays("serviceDetails"),languages=arrays("languages",8),description=text("description",2000),specialty=text("specialty",100),checkedAt=text("checkedAt",10),status=body.status==="published"?"published":"draft";
 const inputSources=Array.isArray(body.sources)?body.sources:[];const sources:Source[]=inputSources.slice(0,8).map(item=>{if(!item||typeof item!=="object")throw new ValidationError("workshop_sources_invalid","Bitte ergänze gültige Quellen.");const r=item as Record<string,unknown>;let u:URL;try{u=new URL(String(r.url));}catch{throw new ValidationError("workshop_sources_invalid","Bitte ergänze gültige Quellen.");}if(u.protocol!=="https:"||u.username||u.password)throw new ValidationError("workshop_sources_https","Quellen müssen HTTPS-Links ohne Zugangsdaten sein.");const directorySource=r.kind==="directory"||/(^|\.)(cybo\.com|gjirafa\.biz|mapcarta\.com)$/.test(u.hostname);return {url:u.href,title:String(r.title??u.hostname).slice(0,150),...(directorySource?{kind:"directory" as const}:r.kind==="official"?{kind:"official" as const}:{})};});
 const today=new Date().toISOString().slice(0,10);if(name.length<3||!cities.slice(1).includes(city)||address.length<5||!/^\+[1-9]\d{7,14}$/.test(phone)||!serviceList.length||!serviceDetails.length||serviceList.some(v=>!services.slice(1).includes(v))||description.length<20||specialty.length<3||!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)||!Number.isFinite(Date.parse(checkedAt))||new Date(checkedAt).toISOString().slice(0,10)!==checkedAt||checkedAt>today)throw new ValidationError("workshop_invalid_profile","Bitte prüfe Name, Ort, Adresse, Telefonnummer, Marke, Leistungen, Beschreibung und Prüfdatum.");
 if(whatsapp&&!/^\+[1-9]\d{7,14}$/.test(whatsapp))throw new ValidationError("workshop_whatsapp_invalid","Bitte ergänze WhatsApp als internationale Telefonnummer oder lasse das Feld leer.");if(status==="published"&&!sources.length)throw new ValidationError("workshop_sources_required","Ein veröffentlichtes Profil braucht mindestens eine nachvollziehbare Quelle.");
 if(status==="published"&&workshopScopeExclusion({id,name}))throw new ValidationError("workshop_scope_excluded","Riparim veröffentlicht Pkw-Werkstätten. "+workshopScopeExclusion({id,name})+" Bitte als Entwurf speichern.");
 const lat=body.lat===null||body.lat===undefined||body.lat===""?null:Number(body.lat),lng=body.lng===null||body.lng===undefined||body.lng===""?null:Number(body.lng);if((lat===null)!==(lng===null)||(lat!==null&&(!Number.isFinite(lat)||lat<41.8||lat>43.3||!Number.isFinite(lng)||lng!<19.8||lng!>21.9)))throw new ValidationError("workshop_coordinates_invalid","Bitte ergänze gültige Koordinaten in Kosovo oder lasse beide Felder leer.");
 return {id,name,city,address,phone,phoneNote:text("phoneNote",150),whatsapp,brands:brandList,services:serviceList,serviceDetails,languages,specialty,description,lat,lng,sources,checkedAt,status,updatedAt:new Date().toISOString()};
}
