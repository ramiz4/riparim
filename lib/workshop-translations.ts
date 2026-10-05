import {z} from "zod";
import type {Workshop} from "./workshops";
export type WorkshopTranslationSource=Pick<Workshop,"id"|"status"|"specialty"|"description"|"serviceDetails"|"phoneNote"|"sources">;
const contentSchema=z.object({specialty:z.string(),description:z.string(),serviceDetails:z.array(z.string()),phoneNote:z.string(),sourceTitles:z.array(z.string())}).strict();
export const workshopTranslationsSchema=z.object({schemaVersion:z.literal(1),workshops:z.array(z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/),sourceHash:z.string().regex(/^[a-f0-9]{64}$/),sq:contentSchema,en:contentSchema}).strict())}).strict();
export type WorkshopTranslations=z.infer<typeof workshopTranslationsSchema>;
export async function workshopTranslationSourceHash(workshop:WorkshopTranslationSource){
 const source={specialty:workshop.specialty,description:workshop.description,serviceDetails:workshop.serviceDetails,phoneNote:workshop.phoneNote,sources:workshop.sources.map(({url,title})=>({url,title}))};
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(source)));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}
// Structural/positional boundary also used by the released server adapter.
export function parseWorkshopTranslations(input:unknown,sources:WorkshopTranslationSource[]):WorkshopTranslations{
 const data=workshopTranslationsSchema.parse(input),known=new Map(sources.map(w=>[w.id,w])),seen=new Set<string>();
 for(const entry of data.workshops){
  if(seen.has(entry.id))throw Error(`Duplicate translation ID: ${entry.id}`);seen.add(entry.id);
  const source=known.get(entry.id);if(!source)throw Error(`Unknown translation ID: ${entry.id}`);
  for(const locale of ["sq","en"] as const){
   const translated=entry[locale];
   for(const field of ["specialty","description","phoneNote"] as const)if(source[field].trim()&&!translated[field].trim())throw Error(`Empty translation: ${entry.id}/${locale}/${field}`);
   for(const [field,originals] of [["serviceDetails",source.serviceDetails],["sourceTitles",source.sources.map(s=>s.title)]] as const){
    if(translated[field].length!==originals.length)throw Error(`Translation array length: ${entry.id}/${locale}/${field}`);
    for(const [index,original] of originals.entries())if(original.trim()&&!translated[field][index].trim())throw Error(`Empty translation: ${entry.id}/${locale}/${field}/${index}`);
   }
  }
 }
 return data;
}
// Repository validation additionally requires complete current published coverage.
export async function validateWorkshopTranslations(input:unknown,sources:WorkshopTranslationSource[]):Promise<WorkshopTranslations>{
 const data=parseWorkshopTranslations(input,sources),known=new Map(sources.map(w=>[w.id,w])),seen=new Set<string>();
 for(const entry of data.workshops){
  seen.add(entry.id);
  if(entry.sourceHash!==await workshopTranslationSourceHash(known.get(entry.id)!))throw Error(`Stale translation sourceHash: ${entry.id}`);
 }
 for(const source of sources)if(source.status==="published"&&!seen.has(source.id))throw Error(`Missing translation: ${source.id}`);
 return data;
}
