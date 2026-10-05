import {isLocale} from "@/lib/i18n/locale";
import {workshopDisplayById} from "@/lib/workshop-display.server";
import {ValidationError} from "@/lib/validation-error";
import {getAdminUser} from "@/app/auth";
import {storage} from "@/db/storage";
import {listWorkshops,validateProfile,profileColumns,profileValues} from "@/db/directory";
import {confirmedPublicationPlace} from "@/db/google-places";
import {googleMapsPlaceUrl} from "@/lib/google-maps-link";
import {json,sameOrigin,readJson} from "@/lib/http";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
 const query=new URL(request.url).searchParams,admin=query.get("admin")==="1",locale=query.get("locale");
 if(admin){const user=await getAdminUser();if(!user)return json({errorCode:"authentication_required",error:"Bitte melde dich an."},401);if(!user.isModerator)return json({errorCode:"forbidden",error:"Kein Zugriff auf die Verwaltung."},403);}
 if(locale!==null&&!isLocale(locale))return json({errorCode:"invalid_request",error:"Ungültige Sprache."},400);
 const workshops=await listWorkshops(admin);
 return json({workshops,...(!admin&&locale!==null&&isLocale(locale)?{displayById:await workshopDisplayById(workshops,locale)}:{})});
 }catch(e){console.error("directory-read",e);return json({errorCode:"unavailable",error:"Die Werkstattdaten sind gerade nicht verfügbar. Bitte versuche es erneut."},503);}}

export async function POST(request:Request){return save(request,false);}
export async function PATCH(request:Request){return save(request,true);}
async function save(request:Request,update:boolean){
 const user=await getAdminUser();
 if(!user)return json({error:"Bitte melde dich an.",errorCode:"authentication_required"},401);
 if(!user.isModerator)return json({error:"Kein Zugriff auf die Verwaltung.",errorCode:"forbidden"},403);
 if(!sameOrigin(request))return json({error:"Ungültige Anfrage.",errorCode:"invalid_request"},403);
 let body:Record<string,unknown>;
 try{body=await readJson(request);}catch{return json({error:"Ungültige Eingaben.",errorCode:"invalid_request"},400);}
 let profile;
 try{
  const id=update?String(body.id??""):String(body.id??crypto.randomUUID());
  if(!/^[a-z0-9][a-z0-9-]{2,80}$/.test(id))return json({error:"Ungültige Profilkennung.",errorCode:"workshop_invalid_id"},400);
  profile=validateProfile(body,id);
 }catch(e){return json({error:e instanceof ValidationError?e.message:"Bitte prüfe die Eingaben.",errorCode:e instanceof ValidationError?e.code:"invalid_request"},400);}
 try{
  const all=await listWorkshops(true),existing=all.find(w=>w.id===profile.id);
  const conflict=()=>json({error:"Das Profil wurde zwischenzeitlich geändert. Lade die Liste neu und prüfe deine Änderungen.",errorCode:"workshop_conflict"},409);
  if(update&&(!existing||existing.updatedAt!==String(body.previousUpdatedAt??"")))return conflict();
  if(!update&&existing)return json({error:"Diese Profilkennung ist bereits vergeben.",errorCode:"workshop_id_exists"},409);
  const placeId=profile.status==="published"?await confirmedPublicationPlace(profile,existing):null;
  if(profile.status==="published"&&!placeId)return json({error:"Für dieses Profil fehlt eine eindeutige bestätigte Google-Zuordnung oder der Google-Eintrag gehört bereits zu einem anderen Profil. Bitte als Entwurf speichern und die Zuordnung prüfen.",errorCode:"workshop_google_required"},422);
  const {db}=storage(),statements=[];
  if(update){
   const fields=profileColumns.slice(1),values=profileValues(profile).slice(1);
   statements.push(db.prepare(`UPDATE workshops SET ${fields.map(x=>`${x}=?`).join(",")} WHERE id=? AND updated_at=?`).bind(...values,profile.id,String(body.previousUpdatedAt??"")));
  }else{
   statements.push(db.prepare(`INSERT INTO workshops (${profileColumns.join(",")}) VALUES (${profileColumns.map(()=>"?").join(",")})`).bind(...profileValues(profile)));
  }
  if(placeId){
   // Update the identity link together with the profile, without copying API stars/reviews.
   // The timestamp predicate also protects the metadata when an optimistic edit conflicts.
   statements.push(db.prepare("INSERT INTO workshop_google_ratings (workshop_id,rating,review_count,maps_url,source_url,source_label,checked_at,source_updated_at) SELECT id,NULL,NULL,?,NULL,NULL,?,NULL FROM workshops WHERE id=? AND updated_at=? ON CONFLICT(workshop_id) DO UPDATE SET maps_url=excluded.maps_url,checked_at=excluded.checked_at").bind(googleMapsPlaceUrl(placeId,`${profile.name} ${profile.address}`),profile.updatedAt,profile.id,profile.updatedAt));
  }
  const result=await db.batch(statements);
  if(update&&!result[0].meta.changes)return conflict();
  return json({id:profile.id,messageCode:"saved"},update?200:201);
 }catch(e){console.error("directory-save",e instanceof Error?e.name:"unknown");return json({error:"Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten.",errorCode:"workshop_save_failed"},503);}
}
