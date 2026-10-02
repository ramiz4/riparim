import { getChatGPTUser } from "@/app/chatgpt-auth";
import { storage, moderatorEmail } from "@/db/storage";
import { services, workshops } from "@/lib/workshops";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const failure=()=>json({error:"Der Nachweis konnte gerade nicht verarbeitet werden. Deine Eingaben bleiben erhalten. Bitte versuche es erneut."},503);
function sameOrigin(r:Request){const origin=r.headers.get("origin");return (!origin||origin===new URL(r.url).origin)&&r.headers.get("sec-fetch-site")!=="cross-site";}
const ownFields="id, workshop, date, vehicle, service, evidence_type, status, moderator_note, display_name, rating, review, created_at, file_name";
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Bitte melde dich an, um deine Nachweise zu sehen."},401);
 try{const {db}=storage();const moderator=user.email.toLowerCase()===moderatorEmail();const admin=new URL(request.url).searchParams.get("moderation")==="1";
 if(admin&&!moderator)return json({error:"Kein Zugriff auf die Prüfung."},403);
 const stmt=admin?db.prepare(`SELECT ${ownFields}, evidence_note FROM visits ORDER BY created_at DESC LIMIT 100`):db.prepare(`SELECT ${ownFields} FROM visits WHERE owner=? ORDER BY created_at DESC LIMIT 100`).bind(user.userId);
 const result=await stmt.all();return json({visits:result.results,moderator});}catch(e){console.error("visits-read",e);return failure();}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Bitte melde dich an, bevor du einen Nachweis einreichst."},401);if(!sameOrigin(request))return json({error:"Ungültige Anfrage."},403);
 if(Number(request.headers.get("content-length")??0)>6*1024*1024)return json({error:"Die Datei ist zu groß. Maximal 5 MB."},413);
 let key:string|null=null;
 try{const {db,bucket}=storage();const f=await request.formData();const str=(key:string,max=100)=>String(f.get(key)??"").trim().slice(0,max);const id=str("id");const workshop=str("workshop");const date=str("date");const vehicle=str("vehicle");const service=str("service");const evidenceType=str("evidenceType");const evidenceNote=str("evidenceNote",3000);
 if(!/^[0-9a-f-]{36}$/.test(id)||!workshops.some(w=>w.id===workshop)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)||date>new Date().toISOString().slice(0,10)||vehicle.length<3||!services.slice(1).includes(service)||!["Rechnung","Service- oder Arbeitsbeleg","Anderer Nachweis"].includes(evidenceType))return json({error:"Bitte prüfe Werkstatt, Besuchsdatum, Fahrzeug, Leistung und Nachweisart."},400);
 const prior=await db.prepare("SELECT owner,status FROM visits WHERE id=?").bind(id).first<{owner:string;status:string}>();if(prior)return prior.owner===user.userId?json({id,status:prior.status}):json({error:"Ungültige Kennung."},409);
 const file=f.get("file");let fileName:string|null=null,fileType:string|null=null;
 if(file instanceof File&&file.size){if(file.size>5*1024*1024)return json({error:"Die Datei ist zu groß. Maximal 5 MB."},413);const bytes=await file.arrayBuffer();const b=new Uint8Array(bytes);const valid=(file.type==="application/pdf"&&String.fromCharCode(...b.slice(0,5))==="%PDF-")||(file.type==="image/jpeg"&&b[0]===255&&b[1]===216&&b[2]===255)||(file.type==="image/png"&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71);if(!valid)return json({error:"Bitte lade eine gültige PDF-, JPG- oder PNG-Datei hoch."},400);key=`evidence/${user.userId}/${id}/${crypto.randomUUID()}`;fileName=file.name.replace(/[^\p{L}\p{N}._ -]/gu,"_").slice(0,120);fileType=file.type;await bucket.put(key,bytes,{httpMetadata:{contentType:fileType}});}
 if(!key&&(evidenceType!=="Anderer Nachweis"||evidenceNote.length<40))return json({error:"Bitte lade einen Beleg hoch oder beschreibe einen anderen nachvollziehbaren Nachweis mit mindestens 40 Zeichen."},400);
 await db.prepare("INSERT INTO visits (id,owner,workshop,date,vehicle,service,evidence_type,evidence_note,file_key,file_name,file_type,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?)").bind(id,user.userId,workshop,date,vehicle,service,evidenceType,evidenceNote,key,fileName,fileType,new Date().toISOString()).run();
 return json({id,status:"pending"},201);
 }catch(e){if(key){try{const referenced=await storage().db.prepare("SELECT id FROM visits WHERE file_key=?").bind(key).first();if(!referenced)await storage().bucket.delete(key);}catch{}}console.error("visit-submit",e);return failure();}
}
export async function PATCH(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Bitte melde dich an."},401);if(!sameOrigin(request))return json({error:"Ungültige Anfrage."},403);
 try{const {db}=storage();const body=await request.json() as Record<string,unknown>;if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Ungültige Anfrage."},400);const id=String(body.id??"");
 if(body.action==="moderate"){if(user.email.toLowerCase()!==moderatorEmail())return json({error:"Kein Zugriff auf die Prüfung."},403);if(!["approved","needs_more"].includes(String(body.status)))return json({error:"Ungültiger Prüfstatus."},400);const note=String(body.note??"").trim().slice(0,1000);if(body.status==="needs_more"&&note.length<5)return json({error:"Bitte erläutere, welcher Nachweis fehlt."},400);const updated=await db.prepare("UPDATE visits SET status=?,moderator_note=?,moderated_at=? WHERE id=? AND status IN ('pending','needs_more')").bind(body.status,note,new Date().toISOString(),id).run();if(!updated.meta.changes)return json({error:"Der Nachweis wurde bereits bearbeitet oder nicht gefunden."},409);return json({status:body.status});}
 if(body.action==="review"){const rating=Number(body.rating),review=String(body.review??"").trim(),name=String(body.name??"").trim();if(!Number.isInteger(rating)||rating<1||rating>5||review.length<30||review.length>2000||name.length<2||name.length>40)return json({error:"Bitte ergänze einen Anzeigenamen, 1–5 Sterne und mindestens 30 Zeichen zu deiner Reparatur."},400);const result=await db.prepare("UPDATE visits SET rating=?,review=?,display_name=?,status='published' WHERE id=? AND owner=? AND status='approved'").bind(rating,review,name,id,user.userId).run();if(!result.meta.changes)return json({error:"Eine Bewertung ist erst nach geprüftem Besuch möglich."},409);return json({status:"published"});}
 return json({error:"Ungültige Aktion."},400);
 }catch(e){console.error("visit-update",e);return failure();}
}
export async function DELETE(request:Request){const user=await getChatGPTUser();if(!user)return json({error:"Bitte melde dich an."},401);if(!sameOrigin(request))return json({error:"Ungültige Anfrage."},403);try{const {db,bucket}=storage();const {id}=await request.json() as {id?:string};const v=await db.prepare("SELECT file_key FROM visits WHERE id=? AND owner=?").bind(String(id),user.userId).first<{file_key:string|null}>();if(!v)return json({error:"Nachweis nicht gefunden."},404);if(v.file_key)await bucket.delete(v.file_key);await db.prepare("DELETE FROM visits WHERE id=? AND owner=?").bind(String(id),user.userId).run();return json({deleted:true});}catch(e){console.error("visit-delete",e);return failure();}}
