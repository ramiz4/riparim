import {workshopIdentityInput} from "./google-identity-fingerprint.mjs";
import {cityCoordinates,type Workshop} from "./workshops";
import {googlePlaceIdFromMapsUrl,googleMapsCid,googleMapsSearchQuery} from "./google-maps-link";

export type GooglePlaceCandidate={id?:string;primaryType?:string;googleMapsUri?:string;displayName?:{text?:string};internationalPhoneNumber?:string;formattedAddress?:string;addressComponents?:{types?:string[];shortText?:string;longText?:string}[];location?:{latitude?:number;longitude?:number}};
type Identity=Pick<Workshop,"name"|"phone"|"city"|"address"|"lat"|"lng">&{googleRating?:Workshop["googleRating"];google?:{snapshot?:{mapsUrl:string}|null}};
const generic=new Set(["auto","autoservis","autoservice","servis","service","servisi","autodiagnoza","automekanik","garage","car","cars","shpk","sh","p","k","kosovo","kosove"]);
const words=(value:string):string[]=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().match(/[a-z0-9]+/g)??[];
export const normalizeWorkshopPhone=(phone:string)=>{let n=phone.replace(/\D/g,"");if(n.startsWith("00"))n=n.slice(2);return n;};
export function googlePlaceSearchRequest(workshop:Identity,pageSize=5,byName=false){
 const phone=normalizeWorkshopPhone(workshop.phone),callingCode=phone.startsWith("383")?"383":phone.startsWith("381")?"381":null;
 // Google recommends a space after the calling code. Preserve legacy +381 numbers.
 const textQuery=callingCode?`+${callingCode} ${phone.slice(callingCode.length)}`:workshop.phone;
 const locationBias=workshop.lat!==null&&workshop.lng!==null
  ?{circle:{center:{latitude:workshop.lat,longitude:workshop.lng},radius:3000}}
  :{rectangle:{low:{latitude:41.8,longitude:19.8},high:{latitude:43.3,longitude:21.9}}};
 // Explicit geography avoids biasing searches toward the server's outgoing IP.
 return {textQuery:byName?`${workshop.name} ${workshop.city} Kosovo`:textQuery,languageCode:"de",regionCode:callingCode==="381"?"RS":"XK",pageSize,locationBias};
}
export function validGooglePlaceId(id:unknown):id is string{return typeof id==="string"&&/^[A-Za-z0-9_-]{10,255}$/.test(id);}
const sourceMapsUrl=(workshop:Identity)=>workshop.googleRating?.mapsUrl??workshop.google?.snapshot?.mapsUrl;
export function googleMapsLinkSearchRequest(workshop:Identity,pageSize=5){return {...googlePlaceSearchRequest(workshop,pageSize,true),textQuery:googleMapsSearchQuery(sourceMapsUrl(workshop))??`${workshop.name} ${workshop.address} Kosovo`};}
export function verifiedGooglePlaceFromMapsLink(workshop:Identity,candidates:GooglePlaceCandidate[]):string|null{
 const source=sourceMapsUrl(workshop),directId=googlePlaceIdFromMapsUrl(source),cid=googleMapsCid(source);
 if(directId)return directId;
 if(cid){const matches=candidates.filter(c=>validGooglePlaceId(c.id)&&googleMapsCid(c.googleMapsUri)===cid);const ids=[...new Set(matches.map(c=>c.id!))];return ids.length===1?ids[0]:null;}
 if(!googleMapsSearchQuery(source))return null;
 const streetGeneric=new Set([...generic,...words(workshop.city),"rr","rruga","rruge","road","magjistralja","magjistralia","km","no","nr","pn","n","prishtina","prishtine","pristina","peja","peje","gjakova","gjakove"]);
 const street=words(workshop.address).filter(w=>w.length>2&&!/^\d+$/.test(w)&&!streetGeneric.has(w));
 const plusCodes=workshop.address.toUpperCase().match(/\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/g)??[];
 const matches=candidates.filter(candidate=>{
  if(!validGooglePlaceId(candidate.id))return false;
  // A search link needs corroboration. Stale/missing Google phone numbers do
  // not prevent a match when the name and precise address agree.
  const phone=candidate.internationalPhoneNumber??workshop.phone;
  const confirmed=verifiedGooglePlace({...workshop,phone},[{...candidate,internationalPhoneNumber:candidate.internationalPhoneNumber??workshop.phone}]);
  if(!confirmed)return false;
  if(normalizeWorkshopPhone(candidate.internationalPhoneNumber??"")===normalizeWorkshopPhone(workshop.phone))return true;
  if(workshop.lat!==null&&workshop.lng!==null){const p=candidate.location!;return Math.hypot((p.latitude!-workshop.lat)*111,(p.longitude!-workshop.lng)*82)<=0.3;}
  const addressWords=words(candidate.formattedAddress??"");
  return plusCodes.some(code=>(candidate.formattedAddress??"").toUpperCase().includes(code))||new Set(street.filter(w=>addressWords.includes(w))).size>=2;
 });
 const ids=[...new Set(matches.map(c=>c.id!))];return ids.length===1?ids[0]:null;
}
export function verifiedGooglePlace(workshop:Identity,candidates:GooglePlaceCandidate[]):string|null{
 const distinctive=words(workshop.name).filter(word=>!generic.has(word));
 const matches=candidates.filter(place=>{
  if(!validGooglePlaceId(place.id)||!workshop.phone||normalizeWorkshopPhone(place.internationalPhoneNumber??"")!==normalizeWorkshopPhone(workshop.phone))return false;
  const country=place.addressComponents?.find(component=>component.types?.includes("country"));
  if(country&&country.shortText!=="XK"&&!words(country.longText??"").some(word=>word==="kosovo"||word==="kosove"))return false;
  if(["electric_vehicle_charging_station","car_wash","parking"].includes(place.primaryType??""))return false;
  const name=words(place.displayName?.text??"").flatMap(word=>word.startsWith("auto")&&word.length>4&&!generic.has(word)?[word,word.slice(4)]:[word]);
  if(!distinctive.length||!distinctive.some(word=>name.includes(word)))return false;
  const p=place.location;
  if(typeof p?.latitude!=="number"||typeof p.longitude!=="number"||p.latitude<41.8||p.latitude>43.3||p.longitude<19.8||p.longitude>21.9)return false;
  if(workshop.lat!==null&&workshop.lng!==null){
   // Exact known premises must agree; a shared chain phone is insufficient.
   const km=Math.hypot((p.latitude-workshop.lat)*111,(p.longitude-workshop.lng)*82);
   if(km>(country?3:0.3))return false;
  }else{
   const cityNames:Record<string,string[]>={Prishtina:["prishtina","prishtine","pristina"],Peja:["peja","peje","pec"],Gjakova:["gjakova","gjakove","djakovica"],Ferizaj:["ferizaj","urosevac"],Mitrovica:["mitrovica","mitrovice"],"Fushë Kosovë":["fushe kosove","fushe kosovo","kosovo polje"],"Graçanicë":["gracanice","gracanica"],"Klinë":["kline","klina"],"Deçan":["decan","decani"]};
   const address=` ${words(place.formattedAddress??"").join(" ")} `;
   if(!(cityNames[workshop.city]??[words(workshop.city).join(" ")]).some(city=>address.includes(` ${city} `)))return false;
   if(!country){const center=cityCoordinates[workshop.city];if(!center||Math.hypot((p.latitude-center[0])*111,(p.longitude-center[1])*82)>15)return false;}
  }
  return true;
 });
 const ids=[...new Set(matches.map(place=>place.id!))];
 return ids.length===1?ids[0]:null;
}
export async function workshopIdentityHash(w:Identity,legacy=false){const input=workshopIdentityInput(w,legacy);const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");}
