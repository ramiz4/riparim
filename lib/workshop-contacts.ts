import {z} from "zod";
import type {WorkshopSourceEntry} from "./workshop-source";
import {workshopEmailSchema,workshopEmailsSchema} from "./workshop-emails";

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

export const workshopEmailContactsSchema=z.object({
 schemaVersion:z.literal(2),
 contacts:z.array(z.object({
  workshopId:z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/),
  matchedName:z.string().min(3).max(120),matchedPhone:z.string().regex(/^\+[1-9]\d{7,14}$/),matchedCity:z.string().min(2).max(80),
  emails:z.array(z.object({address:workshopEmailSchema,sourceUrls:z.array(https).min(1).max(8),checkedAt:date,emailVerification:z.literal("publicly_listed")}).strict()).max(10),
  researchStatus:z.enum(["found","not_found","uncertain"]),checkedUrls:z.array(https),notes:z.string().max(4000)
 }).strict())
}).strict();
export type WorkshopEmailContacts=z.infer<typeof workshopEmailContactsSchema>;
export function validateWorkshopEmailContacts(input:unknown,workshops:WorkshopSourceEntry[]):WorkshopEmailContacts{
 const data=workshopEmailContactsSchema.parse(input),seen=new Set<string>(),known=new Map(workshops.map(w=>[w.id,w])),today=new Date().toISOString().slice(0,10);
 for(const contact of data.contacts){
  const w=known.get(contact.workshopId);
  if(!w||seen.has(contact.workshopId)||w.status!=="published")throw Error(`Unknown or duplicate email workshop: ${contact.workshopId}`);
  seen.add(contact.workshopId);
  if(w.name!==contact.matchedName||w.phone!==contact.matchedPhone||w.city!==contact.matchedCity)throw Error(`Stale email identity: ${contact.workshopId}`);
  workshopEmailsSchema.parse(contact.emails.map(e=>e.address));
  if(contact.emails.some(e=>e.checkedAt>today))throw Error(`Future email evidence: ${contact.workshopId}`);
  if((contact.researchStatus==="found")!==!!contact.emails.length)throw Error(`Inconsistent email research: ${contact.workshopId}`);
 }
 if(seen.size!==known.size)throw Error("Email research must cover the complete catalogue");
 return data;
}
