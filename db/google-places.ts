import {env} from "cloudflare:workers";
import {storage} from "./storage";
import {verifiedGooglePlace,validGooglePlaceId,workshopIdentityHash,type GooglePlaceCandidate} from "@/lib/google-place-identity";
import type {Workshop} from "@/lib/workshops";

export function googlePlacesConfiguration(){const browserKey=(env.GOOGLE_MAPS_BROWSER_API_KEY??"").trim(),serverKey=(env.GOOGLE_PLACES_SERVER_API_KEY??"").trim();return {enabled:!!browserKey&&!!serverKey,browserKey,serverKey};}
type MatchRow={place_id:string|null;profile_hash:string;checked_at:number;retry_after:number};
const DAY=86400000;
export async function resolveWorkshopGooglePlace(workshop:Workshop):Promise<string|null>{
 const config=googlePlacesConfiguration();if(!config.enabled)return null;
 const {db}=storage(),now=Date.now(),hash=await workshopIdentityHash(workshop);
 const existing=await db.prepare("SELECT place_id,profile_hash,checked_at,retry_after FROM workshop_google_places WHERE workshop_id=?").bind(workshop.id).first<MatchRow>();
 if(existing?.profile_hash===hash){
  if(validGooglePlaceId(existing.place_id)&&now-existing.checked_at<365*DAY)return existing.place_id;
  if(existing.retry_after>now)return null;
 }
 // Atomic lease: concurrent cards/profile widgets never repeat the same lookup.
 const lease=await db.prepare("INSERT INTO workshop_google_places (workshop_id,place_id,profile_hash,checked_at,retry_after) VALUES (?,NULL,?,?,?) ON CONFLICT(workshop_id) DO UPDATE SET place_id=NULL,profile_hash=excluded.profile_hash,checked_at=excluded.checked_at,retry_after=excluded.retry_after WHERE workshop_google_places.profile_hash<>excluded.profile_hash OR workshop_google_places.retry_after<=? RETURNING workshop_id").bind(workshop.id,hash,now,now+30000,now).first();
 if(!lease)return null;
 const quotaKey=`google-place-lookups:${new Date(now).toISOString().slice(0,10)}`;
 // At most 100 identity searches/day, independent of user-controlled queries.
 const budget=await db.prepare("INSERT INTO catalog_state (key,value) VALUES (?,'1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(catalog_state.value AS INTEGER)+1 AS TEXT) WHERE CAST(catalog_state.value AS INTEGER)<100 RETURNING value").bind(quotaKey).first();
 if(!budget){await db.prepare("UPDATE workshop_google_places SET retry_after=? WHERE workshop_id=? AND profile_hash=? AND checked_at=?").bind(now+DAY,workshop.id,hash,now).run();return null;}
 try{
  const response=await fetch("https://places.googleapis.com/v1/places:searchText",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":config.serverKey,"X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.internationalPhoneNumber"},body:JSON.stringify({textQuery:workshop.phone,languageCode:"de",regionCode:"XK",pageSize:5}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error("Google Places identity lookup unavailable");
  const body=await response.json() as {places?:GooglePlaceCandidate[]};
  const placeId=verifiedGooglePlace(workshop,Array.isArray(body.places)?body.places:[]);
  // Persist only a Google Place ID and our own matching metadata. Never API ratings/reviews.
  await db.prepare("UPDATE workshop_google_places SET place_id=?,retry_after=? WHERE workshop_id=? AND profile_hash=? AND checked_at=?").bind(placeId,now+(placeId?365:7)*DAY,workshop.id,hash,now).run();
  return placeId;
 }catch{
  await db.prepare("UPDATE workshop_google_places SET retry_after=? WHERE workshop_id=? AND profile_hash=? AND checked_at=?").bind(now+15*60000,workshop.id,hash,now).run();
  throw new Error("Google Places currently unavailable");
 }
}
