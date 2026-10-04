import {env} from "cloudflare:workers";
import {z} from "zod";
import {siteOrigin} from "@/lib/auth/config";
import type {ReviewDecision} from "./contract";

export const deliveryPayloadSchema=z.object({from:z.string().max(320),to:z.array(z.string().email()).length(1),subject:z.string().max(200),html:z.string().max(12000),text:z.string().max(6000)}).strict();
export type DeliveryPayload=z.infer<typeof deliveryPayloadSchema>;
export function emailConfiguration(){
 const key=env.RESEND_API_KEY?.trim(),from=env.TRANSACTIONAL_EMAIL_FROM?.trim();
 if(!key||!/^re_[A-Za-z0-9_-]{10,}$/.test(key)||!from||from.length>320||/[\r\n]/.test(from)||! /^[^<>]*<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$|^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from))return null;
 let origin:URL;try{origin=new URL(siteOrigin());}catch{return null;}if(origin.protocol!=="https:"||origin.username||origin.password)return null;
 return {key,from};
}
export function notificationLink(id:string){
 if(!/^[0-9a-f-]{36}$/.test(id))throw Error("INVALID_VISIT_ID");
 const origin=new URL(siteOrigin());if(origin.protocol!=="https:"||origin.username||origin.password)throw Error("INVALID_SITE_ORIGIN");
 const link=new URL("/anmelden",origin.origin);link.searchParams.set("weiter",`/?besuche=1&einreichung=${id}`);return link.href;
}
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
export function reviewEmail(decision:ReviewDecision,id:string,from:string,to:string):DeliveryPayload{
 const title=decision==="published"?"Deine Riparim-Bewertung wurde freigegeben":"Bitte ergänze deinen Besuchsnachweis";
 const copy=decision==="published"?"Deine Bewertung wurde geprüft und veröffentlicht. Du kannst sie nach der Anmeldung in deinen Einreichungen ansehen.":"Für deine Bewertung wird eine Ergänzung benötigt. Melde dich an, um den geschützten Prüfhinweis zu lesen und deinen Nachweis zu ergänzen.";
 const url=notificationLink(id),text=`${title}\n\n${copy}\n\nDeine Einreichung nach der Anmeldung öffnen:\n${url}\n\nDiese Nachricht informiert dich über deine eigene Einreichung bei Riparim. Private Belege und Prüfvermerke werden ausschließlich im geschützten Kontobereich angezeigt.`;
 const html=`<!doctype html><html lang="de" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body lang="de" dir="ltr" style="margin:0;background:#ffffff;color:#173c35;font-family:Arial,sans-serif"><div lang="de" dir="ltr" style="max-width:600px;margin:0 auto;padding:28px 22px;font-size:17px;line-height:1.6"><p style="font-weight:bold">Riparim</p><h1 style="font-size:25px;line-height:1.3">${title}</h1><p>${copy}</p><p><a href="${escape(url)}" style="color:#205d52;font-weight:bold;text-decoration:underline">Deine Einreichung nach der Anmeldung öffnen</a></p><p style="font-size:14px">Diese Nachricht informiert dich über deine eigene Einreichung bei Riparim. Private Belege und Prüfvermerke werden ausschließlich im geschützten Kontobereich angezeigt.</p></div></body></html>`;
 return deliveryPayloadSchema.parse({from,to:[to],subject:title,html,text});
}
export class DeliveryError extends Error{constructor(public code:string,public retryable:boolean){super(code);}}
export async function sendReviewEmail(payload:DeliveryPayload,key:string,id:string){
 let response:Response;
 try{response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":id},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});}
 catch{throw new DeliveryError("provider_unavailable",true);}
 if(!response.ok){
  if(response.status===429)throw new DeliveryError("rate_limited",true);
  if(response.status>=500)throw new DeliveryError("provider_unavailable",true);
  if(response.status===409){let error;try{error=await response.json() as {name?:unknown};}catch{}if(error?.name==="concurrent_idempotent_requests")throw new DeliveryError("provider_unavailable",true);}
  throw new DeliveryError("provider_rejected",false);
 }
 let result:unknown;try{result=await response.json();}catch{throw new DeliveryError("provider_unavailable",true);}
 const data=z.object({id:z.string().min(1).max(100)}).safeParse(result);
 if(!data.success)throw new DeliveryError("provider_unavailable",true);
 return data.data.id;
}
