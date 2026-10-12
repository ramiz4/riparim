import {z} from "zod";
import {storage} from "@/db/storage";
import {getAuthAdmin} from "@/lib/auth/admin";
import {getAuthConfig} from "@/lib/auth/config";
import {accountIdentity} from "@/lib/auth/identities";
import {accountBlocked,providerBlocked} from "@/lib/auth/account-status";
import {callbackLocale} from "@/lib/auth/locale";
import {validUserId} from "@/lib/admin-users";
import {DeliveryError,deliveryPayloadSchema,reviewEmail} from "./email";
import {emailConfiguration} from "./transports";
import {maxNotificationAttempts,type NotificationRow,type NotificationView} from "./contract";

const retryWindow=23*3600000;
const retryDelays=[60000,300000,900000,1800000,3600000];
const withinWindow=(row:NotificationRow)=>row.first_attempt_at===null||Date.now()-row.first_attempt_at<retryWindow;
export function canRetryNotification(row:NotificationRow){return row.attempts<maxNotificationAttempts&&row.next_attempt_at<=Date.now()&&!row.smtp_in_flight&&!["sent","suppressed","unknown"].includes(row.state)&&withinWindow(row)&&(row.state!=="sending"||(row.lease_until??0)<=Date.now());}
async function keyHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");}
async function recipient(owner:string){
 const config=await getAuthConfig(),auth=await getAuthAdmin();
 if(!config?.enabled||!auth||auth.projectUrl!==config.projectUrl)throw new DeliveryError("auth_configuration_missing",false);
 const identity=await accountIdentity(owner,"supabase",config.projectUrl);
 if(!identity||!validUserId(identity.subject))throw new DeliveryError("no_verified_contact",false);
 if(await accountBlocked(owner))throw new DeliveryError("account_blocked",false);
 const id=identity.subject,result=await auth.client.auth.admin.getUserById(id),user=result.data.user;
 if(result.error){if(result.error.status===401||result.error.status===403)throw new DeliveryError("auth_configuration_missing",false);if(result.error.status===404)throw new DeliveryError("no_verified_contact",false);throw new DeliveryError("provider_unavailable",true);}
 if(!user||user.id!==id||!user.email_confirmed_at||!user.email||!deliveryPayloadSchema.shape.to.element.safeParse(user.email).success||user.email.length>254)throw new DeliveryError("no_verified_contact",false);
 if(providerBlocked(user))throw new DeliveryError("account_blocked",false);
 return {email:user.email,locale:callbackLocale(user.user_metadata?.preferred_locale)};
}
async function stillCurrent(row:NotificationRow){
 if(await accountBlocked(row.owner))return false;
 return !!await storage().db.prepare("SELECT id FROM visits WHERE id=? AND owner=? AND revision=? AND status=?").bind(row.visit_id,row.owner,row.revision,row.decision).first();
}
async function setState(row:NotificationRow,state:NotificationRow["state"],error:string|null,next=Date.now(),knownNonAcceptance=false){
 await storage().db.prepare("UPDATE review_notifications SET state=?,last_error=?,next_attempt_at=?,smtp_in_flight=CASE WHEN ? THEN 0 ELSE smtp_in_flight END,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=? AND state='sending'").bind(state,error,next,knownNonAcceptance?1:0,row.id,row.lease_token).run();
}
async function deliver(row:NotificationRow){
 let smtpStarted=false,knownNonAcceptance=false;
 try{
  if(!withinWindow(row)){await setState(row,"unknown","idempotency_window_expired");return;}
  if(!await stillCurrent(row)){await setState(row,"suppressed","superseded");return;}
  const config=emailConfiguration();if(!config)throw new DeliveryError("configuration_missing",false);
  const contact=await recipient(row.owner),fingerprint=await keyHash(config.scope);
  let body:string;
  if(row.first_attempt_at!==null){
   if((row.transport??"resend")!==config.kind)throw new DeliveryError("credential_changed",false);
   if(row.provider_key_hash!==fingerprint)throw new DeliveryError("credential_changed",false);
   let stored:unknown;try{stored=row.payload?JSON.parse(row.payload):null;}catch{throw new DeliveryError("invalid_payload",false);}
   const parsed=deliveryPayloadSchema.safeParse(stored);if(!parsed.success)throw new DeliveryError("invalid_payload",false);
   if(parsed.data.to[0]!==contact.email)throw new DeliveryError("recipient_changed",false);
   // Validate stored content without reserializing it: historical ordering and
   // whitespace also belong to the provider idempotency request.
   body=row.payload!;
  }else body=JSON.stringify(reviewEmail(row.decision,row.visit_id,config.from,contact.email,contact.locale));
  const wire=config.kind==="smtp"?(row.first_attempt_at===null?await config.prepare(body,row.id):row.wire_payload):null;
  if(config.kind==="smtp"&&!wire)throw new DeliveryError("invalid_payload",false);
  // Freeze the exact payload and credential scope before the first provider
  // call. Resend may retry that exact idempotent request; SMTP requires
  // reconciliation after any uncertain handover.
  if(!await stillCurrent(row)){await setState(row,"suppressed","superseded");return;}
  smtpStarted=!config.idempotent;
  const committed=await storage().db.prepare("UPDATE review_notifications SET payload=?,provider_key_hash=?,transport=?,wire_payload=?,smtp_in_flight=?,first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND lease_token=? AND state='sending' AND lease_until>?").bind(body,fingerprint,config.kind,wire,smtpStarted?1:0,Date.now(),row.id,row.lease_token,Date.now()).run();
  if(!committed.meta.changes)return;
  let providerId:string;
  try{providerId=await config.send(body,wire,row.id);}catch(error){knownNonAcceptance=error instanceof DeliveryError&&!error.uncertain;throw error;}
  await storage().db.prepare("UPDATE review_notifications SET state='sent',provider_id=?,payload=NULL,wire_payload=NULL,smtp_in_flight=0,last_error=NULL,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=? AND state='sending'").bind(providerId,row.id,row.lease_token).run();
 }catch(error){
  const code=error instanceof DeliveryError?error.code:"provider_unavailable",retry=error instanceof DeliveryError?error.retryable:true;
  if(smtpStarted&&!knownNonAcceptance){await setState(row,"unknown","delivery_uncertain");}
  else if(retry){await setState(row,row.attempts>=maxNotificationAttempts?"failed":"pending",row.attempts>=maxNotificationAttempts?"retry_limit":code,Date.now()+retryDelays[Math.max(0,Math.min(row.attempts-1,retryDelays.length-1))],knownNonAcceptance);}
  else await setState(row,row.attempts>=maxNotificationAttempts?"failed":"blocked",row.attempts>=maxNotificationAttempts?"retry_limit":code,Date.now()+retryDelays[Math.min(row.attempts-1,retryDelays.length-1)],knownNonAcceptance);
  console.error("review-notification-deferred",{event:row.id,reason:code});
 }
}
export async function processNotifications({id,manual=false}:{id?:string;manual?:boolean}={}){
 // Every send belongs to one explicit moderation/retry request. No bulk drain.
 if(!id)return false;
 const db=storage().db,now=Date.now();
 const candidate=await db.prepare("SELECT * FROM review_notifications WHERE id=?").bind(id).first<NotificationRow>();
 if(!candidate||["sent","suppressed","unknown"].includes(candidate.state))return false;
 if(candidate.state==="sending"&&(candidate.lease_until??0)>now)return false;
 if(candidate.smtp_in_flight){
  await db.prepare("UPDATE review_notifications SET state='unknown',last_error='delivery_uncertain',lease_until=NULL,lease_token=NULL WHERE id=? AND smtp_in_flight=1 AND (state IN ('pending','blocked','failed') OR (state='sending' AND lease_until<=?))").bind(id,now).run();return false;
 }
 if(!withinWindow(candidate)){
  await db.prepare("UPDATE review_notifications SET state='unknown',last_error='idempotency_window_expired' WHERE id=? AND (state IN ('pending','blocked','failed') OR (state='sending' AND lease_until<=?))").bind(id,now).run();return false;
 }
 if(manual?!canRetryNotification(candidate):candidate.attempts!==0||candidate.state!=="pending")return false;
 const token=crypto.randomUUID();
 // The persisted cooldown and attempt budget are checked again while claiming.
 // Persist cooldown before provider access so interrupted attempts retain it.
 // Matching the attempt count prevents a stale read from choosing a shorter delay.
 const claimed=await db.prepare(`UPDATE review_notifications SET state='sending',lease_token=?,lease_until=?,next_attempt_at=?,attempts=attempts+1 WHERE id=? AND smtp_in_flight=0 AND attempts<? AND attempts=? AND next_attempt_at<=? AND (state IN (${manual?"'pending','blocked','failed'":"'pending'"}) OR (state='sending' AND lease_until<=?)) RETURNING *`).bind(token,now+120000,now+retryDelays[Math.min(candidate.attempts,retryDelays.length-1)],id,manual?maxNotificationAttempts:1,candidate.attempts,now,now).first<NotificationRow>();
 if(!claimed)return false;
 await deliver(claimed);return true;
}
export async function notificationQueue(cursor?:string|null){
 const db=storage().db;
 let page:{date:string;id:string}|null=null;
 if(cursor){try{if(cursor.length>512)throw Error();page=z.object({date:z.string().max(30).refine(value=>Number.isFinite(Date.parse(value))),id:z.string().min(1).max(100).regex(/^[a-z0-9-]+$/)}).strict().parse(JSON.parse(atob(cursor)));}catch{throw Error("INVALID_CURSOR");}}
 const rows=await db.prepare(`SELECT n.*,w.name AS workshop_name FROM review_notifications n LEFT JOIN visits v ON v.id=n.visit_id LEFT JOIN workshops w ON w.id=v.workshop WHERE n.state NOT IN ('sent','suppressed')${page?" AND (n.created_at<? OR (n.created_at=? AND n.id<?))":""} ORDER BY n.created_at DESC,n.id DESC LIMIT 51`).bind(...(page?[page.date,page.date,page.id]:[])).all<NotificationRow&{workshop_name:string|null}>();
 const items=rows.results.slice(0,50),last=items.at(-1);
 const notifications:NotificationView[]=items.map(row=>{
  const leased=row.state==="sending"&&(row.lease_until??0)>Date.now(),finished=["sent","suppressed","unknown"].includes(row.state);
  const error=!leased&&!finished?(row.smtp_in_flight?"delivery_uncertain":!withinWindow(row)?"idempotency_window_expired":row.attempts>=maxNotificationAttempts?"retry_limit":row.last_error):row.last_error;
  const state=!leased&&!finished&&["delivery_uncertain","idempotency_window_expired"].includes(error??"")?"unknown":!leased&&!finished&&error==="retry_limit"?"failed":row.state;
  // Report expired/historical limits on reads; no periodic cleanup is needed.
  return {id:row.id,visitId:row.visit_id,workshopName:row.workshop_name??"Ehemalige Einreichung",decision:row.decision,state,attempts:row.attempts,nextAttemptAt:row.next_attempt_at,createdAt:row.created_at,error,retryable:canRetryNotification(row)};
 });
 return {notifications,nextCursor:rows.results.length>50&&last?btoa(JSON.stringify({date:last.created_at,id:last.id})):null,configured:!!emailConfiguration()};
}
