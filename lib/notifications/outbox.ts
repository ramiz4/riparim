import {z} from "zod";
import {storage} from "@/db/storage";
import {getAuthAdmin} from "@/lib/auth/admin";
import {getAuthConfig} from "@/lib/auth/config";
import {providerAccountId} from "@/app/auth";
import {accountBlocked,providerBlocked} from "@/lib/auth/account-status";
import {callbackLocale} from "@/lib/auth/locale";
import {validUserId} from "@/lib/admin-users";
import {DeliveryError,deliveryPayloadSchema,emailConfiguration,reviewEmail,sendReviewEmail} from "./email";
import type {NotificationRow,NotificationView} from "./contract";

const retryWindow=23*3600000,maxAutomaticAttempts=5;
const retryDelays=[60000,300000,1800000,7200000,21600000];
const withinWindow=(row:NotificationRow)=>row.first_attempt_at===null||Date.now()-row.first_attempt_at<retryWindow;
export function canRetryNotification(row:NotificationRow){return !["sent","suppressed","unknown"].includes(row.state)&&withinWindow(row)&&(row.state!=="sending"||(row.lease_until??0)<=Date.now());}
async function keyHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");}
async function recipient(owner:string){
 const config=await getAuthConfig(),auth=await getAuthAdmin();
 if(!config?.enabled||!auth||auth.projectUrl!==config.projectUrl)throw new DeliveryError("auth_configuration_missing",false);
 const prefix=providerAccountId(config.projectUrl,"");let account=owner;
 if(!account.startsWith(prefix)){
  const link=await storage().db.prepare("SELECT account_id FROM auth_links WHERE legacy_owner=?").bind(owner).first<{account_id:string}>();
  account=link?.account_id??"";
 }
 if(!account.startsWith(prefix)||!validUserId(account.slice(prefix.length)))throw new DeliveryError("no_verified_contact",false);
 if(await accountBlocked(account)||await accountBlocked(owner))throw new DeliveryError("account_blocked",false);
 const id=account.slice(prefix.length),result=await auth.client.auth.admin.getUserById(id),user=result.data.user;
 if(result.error){if(result.error.status===401||result.error.status===403)throw new DeliveryError("auth_configuration_missing",false);if(result.error.status===404)throw new DeliveryError("no_verified_contact",false);throw new DeliveryError("provider_unavailable",true);}
 if(!user||user.id!==id||!user.email_confirmed_at||!user.email||!deliveryPayloadSchema.shape.to.element.safeParse(user.email).success||user.email.length>254)throw new DeliveryError("no_verified_contact",false);
 if(providerBlocked(user))throw new DeliveryError("account_blocked",false);
 return {email:user.email,locale:callbackLocale(user.user_metadata?.preferred_locale)};
}
async function stillCurrent(row:NotificationRow){
 if(await accountBlocked(row.owner))return false;
 return !!await storage().db.prepare("SELECT id FROM visits WHERE id=? AND owner=? AND revision=? AND status=?").bind(row.visit_id,row.owner,row.revision,row.decision).first();
}
async function setState(row:NotificationRow,state:NotificationRow["state"],error:string|null,next=Date.now()){
 await storage().db.prepare("UPDATE review_notifications SET state=?,last_error=?,next_attempt_at=?,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=? AND state='sending'").bind(state,error,next,row.id,row.lease_token).run();
}
async function deliver(row:NotificationRow){
 try{
  if(!withinWindow(row)){await setState(row,"unknown","idempotency_window_expired");return;}
  if(!await stillCurrent(row)){await setState(row,"suppressed","superseded");return;}
  const config=emailConfiguration();if(!config)throw new DeliveryError("configuration_missing",false);
  const contact=await recipient(row.owner),fingerprint=await keyHash(config.key);
  let body:string;
  if(row.first_attempt_at!==null){
   if(row.provider_key_hash!==fingerprint)throw new DeliveryError("credential_changed",false);
   let stored:unknown;try{stored=row.payload?JSON.parse(row.payload):null;}catch{throw new DeliveryError("invalid_payload",false);}
   const parsed=deliveryPayloadSchema.safeParse(stored);if(!parsed.success)throw new DeliveryError("invalid_payload",false);
   if(parsed.data.to[0]!==contact.email)throw new DeliveryError("recipient_changed",false);
   // Validate stored content without reserializing it: historical ordering and
   // whitespace also belong to the provider idempotency request.
   body=row.payload!;
  }else body=JSON.stringify(reviewEmail(row.decision,row.visit_id,config.from,contact.email,contact.locale));
  // Freeze the exact payload and credential scope before the first provider
  // call. A lost acknowledgement must retry the same idempotent request.
  if(!await stillCurrent(row)){await setState(row,"suppressed","superseded");return;}
  const committed=await storage().db.prepare("UPDATE review_notifications SET payload=?,provider_key_hash=?,first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND lease_token=? AND state='sending'").bind(body,fingerprint,Date.now(),row.id,row.lease_token).run();
  if(!committed.meta.changes)return;
  const providerId=await sendReviewEmail(body,config.key,row.id);
  await storage().db.prepare("UPDATE review_notifications SET state='sent',provider_id=?,payload=NULL,last_error=NULL,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=? AND state='sending'").bind(providerId,row.id,row.lease_token).run();
 }catch(error){
  const code=error instanceof DeliveryError?error.code:"provider_unavailable",retry=error instanceof DeliveryError?error.retryable:true;
  if(retry){await setState(row,row.attempts>=maxAutomaticAttempts?"failed":"pending",row.attempts>=maxAutomaticAttempts?"retry_limit":code,Date.now()+retryDelays[Math.max(0,Math.min(row.attempts-1,retryDelays.length-1))]);}
  else await setState(row,"blocked",code);
  console.error("review-notification-deferred",{event:row.id,reason:code});
 }
}
export async function processNotifications({id,force=false,limit=4}:{id?:string;force?:boolean;limit?:number}={}){
 const db=storage().db,now=Date.now();
 const candidates=await db.prepare(`SELECT * FROM review_notifications WHERE ${id?"id=? AND ":""}((state='pending' AND (next_attempt_at<=? OR ?=1)) OR (state='sending' AND lease_until<=?)${force?" OR state IN ('blocked','failed')":""}) ORDER BY next_attempt_at,id LIMIT ?`).bind(...(id?[id]:[]),now,force?1:0,now,Math.min(4,Math.max(1,limit))).all<NotificationRow>();
 for(const candidate of candidates.results){
  if(!withinWindow(candidate)){
   await db.prepare("UPDATE review_notifications SET state='unknown',last_error='idempotency_window_expired' WHERE id=? AND (state IN ('pending','blocked','failed') OR (state='sending' AND lease_until<=?))").bind(candidate.id,now).run();continue;
  }
  if(!force&&candidate.attempts>=maxAutomaticAttempts){await db.prepare("UPDATE review_notifications SET state='failed',last_error='retry_limit' WHERE id=? AND (state='pending' OR (state='sending' AND lease_until<=?))").bind(candidate.id,now).run();continue;}
  const token=crypto.randomUUID();
  const claimed=await db.prepare(`UPDATE review_notifications SET state='sending',lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=? AND ((state='pending' AND (next_attempt_at<=? OR ?=1)) OR (state='sending' AND lease_until<=?)${force?" OR state IN ('blocked','failed')":""}) RETURNING *`).bind(token,Date.now()+120000,candidate.id,now,force?1:0,now).first<NotificationRow>();
  if(claimed)await deliver(claimed);
 }
}
export async function notificationQueue(cursor?:string|null){
 const db=storage().db;
 let page:{date:string;id:string}|null=null;
 if(cursor){try{if(cursor.length>512)throw Error();page=z.object({date:z.string().max(30).refine(value=>Number.isFinite(Date.parse(value))),id:z.string().min(1).max(100).regex(/^[a-z0-9-]+$/)}).strict().parse(JSON.parse(atob(cursor)));}catch{throw Error("INVALID_CURSOR");}}
 const rows=await db.prepare(`SELECT n.*,w.name AS workshop_name FROM review_notifications n LEFT JOIN visits v ON v.id=n.visit_id LEFT JOIN workshops w ON w.id=v.workshop WHERE n.state NOT IN ('sent','suppressed')${page?" AND (n.created_at<? OR (n.created_at=? AND n.id<?))":""} ORDER BY n.created_at DESC,n.id DESC LIMIT 51`).bind(...(page?[page.date,page.date,page.id]:[])).all<NotificationRow&{workshop_name:string|null}>();
 const items=rows.results.slice(0,50),last=items.at(-1);
 const notifications:NotificationView[]=items.map(row=>({id:row.id,visitId:row.visit_id,workshopName:row.workshop_name??"Ehemalige Einreichung",decision:row.decision,state:row.state,attempts:row.attempts,nextAttemptAt:row.next_attempt_at,createdAt:row.created_at,error:row.last_error,retryable:canRetryNotification(row)}));
 return {notifications,nextCursor:rows.results.length>50&&last?btoa(JSON.stringify({date:last.created_at,id:last.id})):null,configured:!!emailConfiguration()};
}
