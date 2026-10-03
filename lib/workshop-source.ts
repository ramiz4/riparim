import {z} from "zod";
import {normalizeWorkshopPhone,validGooglePlaceId} from "./google-place-identity";
import {services} from "./workshops";

const https=z.string().url().refine(value=>{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password;},"HTTPS-Quelle ohne Zugangsdaten erforderlich");
const timestamp=z.string().refine(value=>Number.isFinite(Date.parse(value)),"Ungültiges Datum");
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,"Ungültiges Prüfdatum");
const texts=z.array(z.string().min(1).max(200)).max(30);
const snapshot=z.object({rating:z.number().min(1).max(5).nullable(),count:z.number().int().nonnegative().nullable(),mapsUrl:https,sourceUrl:https.nullable(),sourceLabel:z.string().min(1).nullable(),checkedAt:timestamp,sourceUpdatedAt:timestamp.nullable()}).strict().superRefine((g,ctx)=>{if((g.rating!==null||g.count!==null)&&(!g.sourceUrl||!g.sourceLabel))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Numerische Google-Angaben brauchen eine belegte Quelle"});});

export const workshopSourceEntrySchema=z.object({
 id:z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/),name:z.string().min(3).max(120),city:z.string().min(2).max(80),address:z.string().min(5).max(250),phone:z.string().regex(/^\+[1-9]\d{7,14}$/),phoneNote:z.string().max(150),whatsapp:z.union([z.literal(""),z.string().regex(/^\+[1-9]\d{7,14}$/)]),
 brands:texts,services:texts.min(1),serviceDetails:texts.min(1),languages:texts.max(8),specialty:z.string().min(3).max(100),description:z.string().min(20).max(2000),lat:z.number().min(41.8).max(43.3).nullable(),lng:z.number().min(19.8).max(21.9).nullable(),
 sources:z.array(z.object({url:https,title:z.string().min(1).max(150),kind:z.enum(["official","directory"]).optional()}).strict()).min(1).max(8),checkedAt:date,status:z.enum(["draft","published"]),updatedAt:timestamp,
 google:z.object({placeId:z.string().refine(validGooglePlaceId).nullable(),matchedAt:timestamp.nullable(),snapshot:snapshot.nullable()}).strict()
}).strict().superRefine((w,ctx)=>{
 if(w.services.some(service=>!services.slice(1).includes(service)))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Unbekannte Leistungskategorie"});
 if((w.lat===null)!==(w.lng===null))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Koordinaten müssen paarweise vorliegen"});
 if((w.google.placeId===null)!==(w.google.matchedAt===null))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Place-ID und Zuordnungsdatum müssen zusammen vorliegen"});
});
export type WorkshopSourceEntry=z.infer<typeof workshopSourceEntrySchema>;
export const workshopCatalogueSchema=z.object({
 "$schema":z.literal("./workshops.schema.json"),schemaVersion:z.literal(1),updatedAt:timestamp,
 coverage:z.object({countryCode:z.literal("XK"),published:z.number().int().nonnegative(),drafts:z.number().int().nonnegative(),estimatedTotal:z.number().int().positive().nullable(),estimateSource:z.literal("user"),complete:z.literal(false)}).strict(),
 googleImport:z.object({status:z.enum(["not_started","partial","completed"]),reason:z.string().nullable(),matchedPlaceIds:z.number().int().nonnegative(),numericSnapshotRatings:z.number().int().nonnegative(),pendingPublishedMatches:z.number().int().nonnegative()}).strict(),
 workshops:z.array(workshopSourceEntrySchema)
}).strict();
export type WorkshopCatalogue=z.infer<typeof workshopCatalogueSchema>;

export function catalogueStats(workshops:WorkshopSourceEntry[]){
 const published=workshops.filter(w=>w.status==="published"),phones=new Map<string,string[]>();
 for(const w of workshops){const key=normalizeWorkshopPhone(w.phone);phones.set(key,[...(phones.get(key)??[]),w.id]);}
 return {published:published.length,drafts:workshops.length-published.length,matchedPlaceIds:workshops.filter(w=>w.google.placeId!==null).length,numericSnapshotRatings:workshops.filter(w=>w.google.snapshot?.rating!=null).length,pendingPublishedMatches:published.filter(w=>w.google.placeId===null).length,sharedPhones:[...phones.values()].filter(ids=>ids.length>1)};
}

export function validateWorkshopCatalogue(input:unknown):WorkshopCatalogue{
 const data=workshopCatalogueSchema.parse(input),ids=new Set<string>(),places=new Set<string>();
 const now=Date.now(),today=new Date(now).toISOString().slice(0,10);
 for(const w of data.workshops){
  if(ids.has(w.id))throw Error(`Doppelte Werkstattkennung: ${w.id}`);ids.add(w.id);
  if(w.google.placeId){if(places.has(w.google.placeId))throw Error(`Doppelte Google-Place-ID: ${w.id}`);places.add(w.google.placeId);}
  if(w.checkedAt>today||Date.parse(w.updatedAt)>now||w.google.matchedAt&&Date.parse(w.google.matchedAt)>now||w.google.snapshot&&Date.parse(w.google.snapshot.checkedAt)>now)throw Error(`Prüfdatum liegt in der Zukunft: ${w.id}`);
 }
 const stats=catalogueStats(data.workshops);
 for(const key of ["published","drafts"] as const)if(data.coverage[key]!==stats[key])throw Error(`Abweichende Bestandszahl: ${key}`);
 for(const key of ["matchedPlaceIds","numericSnapshotRatings","pendingPublishedMatches"] as const)if(data.googleImport[key]!==stats[key])throw Error(`Abweichende Google-Abdeckung: ${key}`);
 return data;
}

const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function mergeWorkshopCatalogue(current:WorkshopCatalogue,incoming:unknown[]){
 const workshops=current.workshops.map(w=>structuredClone(w)),report={added:[] as string[],updated:[] as string[],unchanged:[] as string[],deduplicated:[] as {incomingId:string;keptId:string}[]};
 for(const input of incoming){
  const candidate=workshopSourceEntrySchema.parse(input);
  const byId=workshops.find(w=>w.id===candidate.id);
  const byPlace=candidate.google.placeId?workshops.find(w=>w.google.placeId===candidate.google.placeId):undefined;
  const matches=workshops.filter(w=>normalizeWorkshopPhone(w.phone)===normalizeWorkshopPhone(candidate.phone)&&normalize(w.name)===normalize(candidate.name)&&normalize(w.city)===normalize(candidate.city)&&normalize(w.address)===normalize(candidate.address));
  if(matches.length>1||byId&&byPlace&&byId.id!==byPlace.id)throw Error(`Mehrdeutiger Import: ${candidate.id}`);
  const existing=byId??byPlace??matches[0];
  if(!existing){workshops.push(candidate);report.added.push(candidate.id);continue;}
  if(candidate.id!==existing.id)report.deduplicated.push({incomingId:candidate.id,keptId:existing.id});
  // Profile edits, Google identity and sourced snapshots have separate timestamps.
  const newerProfile=Date.parse(candidate.updatedAt)>Date.parse(existing.updatedAt);
  const newerIdentity=!!candidate.google.placeId&&(!existing.google.matchedAt||Date.parse(candidate.google.matchedAt!)>Date.parse(existing.google.matchedAt));
  const newerSnapshot=!!candidate.google.snapshot&&(!existing.google.snapshot||Date.parse(candidate.google.snapshot.checkedAt)>Date.parse(existing.google.snapshot.checkedAt));
  const identityChanged=newerProfile&&(["name","phone","city","address","lat","lng"] as const).some(key=>candidate[key]!==existing[key]);
  if(!newerProfile&&!newerIdentity&&!newerSnapshot){report.unchanged.push(existing.id);continue;}
  const merged={...(newerProfile?candidate:existing),id:existing.id,google:{placeId:newerIdentity?candidate.google.placeId:identityChanged?null:existing.google.placeId,matchedAt:newerIdentity?candidate.google.matchedAt:identityChanged?null:existing.google.matchedAt,snapshot:newerSnapshot?candidate.google.snapshot:existing.google.snapshot}};
  workshops[workshops.indexOf(existing)]=merged;report.updated.push(existing.id);
 }
 workshops.sort((a,b)=>a.id.localeCompare(b.id));const stats=catalogueStats(workshops);
 const catalogue:WorkshopCatalogue={...current,updatedAt:new Date().toISOString(),coverage:{...current.coverage,published:stats.published,drafts:stats.drafts},googleImport:{...current.googleImport,status:stats.pendingPublishedMatches===0?"completed":stats.matchedPlaceIds>0?"partial":"not_started",matchedPlaceIds:stats.matchedPlaceIds,numericSnapshotRatings:stats.numericSnapshotRatings,pendingPublishedMatches:stats.pendingPublishedMatches},workshops};
 return {catalogue:validateWorkshopCatalogue(catalogue),report:{...report,sharedPhones:stats.sharedPhones}};
}
