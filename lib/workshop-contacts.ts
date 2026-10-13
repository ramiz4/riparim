import {z} from "zod";
import type {WorkshopSourceEntry} from "./workshop-source";

const https=z.string().url().refine(value=>{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password;},"HTTPS-Quelle ohne Zugangsdaten erforderlich");
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,"Ungültiges Prüfdatum");
export const workshopContactsSchema=z.object({
 schemaVersion:z.literal(1),
 contacts:z.array(z.object({
  workshopId:z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/),
  email:z.string().email().max(254),website:https,sourceUrls:z.array(https).min(1).max(8),checkedAt:date,
  matchedName:z.string().min(3).max(120),matchedPhone:z.string().regex(/^\+[1-9]\d{7,14}$/),matchedCity:z.string().min(2).max(80),
  // A public source proves publication, not delivery, consent or ownership.
  emailVerification:z.literal("publicly_listed")
 }).strict())
}).strict();
export type WorkshopContacts=z.infer<typeof workshopContactsSchema>;
export type WorkshopContact=WorkshopContacts["contacts"][number];

export function validateWorkshopContacts(input:unknown,workshops:WorkshopSourceEntry[]):WorkshopContacts{
 const data=workshopContactsSchema.parse(input),ids=new Set<string>(),profiles=new Map(workshops.map(w=>[w.id,w]));
 const today=new Date().toISOString().slice(0,10);
 for(const contact of data.contacts){
  if(ids.has(contact.workshopId))throw Error(`Doppelter Werkstattkontakt: ${contact.workshopId}`);
  ids.add(contact.workshopId);
  const profile=profiles.get(contact.workshopId);
  if(!profile||profile.status!=="published")throw Error(`Kontakt ohne veröffentlichtes Profil: ${contact.workshopId}`);
  if(profile.name!==contact.matchedName||profile.phone!==contact.matchedPhone||profile.city!==contact.matchedCity)throw Error(`Kontaktidentität stimmt nicht überein: ${contact.workshopId}`);
  if(contact.checkedAt>today)throw Error(`Kontaktprüfdatum liegt in der Zukunft: ${contact.workshopId}`);
 }
 return data;
}
