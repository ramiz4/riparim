import type {Workshop} from "./workshops";

export type GooglePlaceCandidate={id?:string;displayName?:{text?:string};internationalPhoneNumber?:string;formattedAddress?:string;addressComponents?:{types?:string[];shortText?:string;longText?:string}[];location?:{latitude?:number;longitude?:number}};
type Identity=Pick<Workshop,"name"|"phone"|"city"|"address"|"lat"|"lng">;
const generic=new Set(["auto","autoservis","autoservice","servis","service","servisi","autodiagnoza","automekanik","garage","car","cars","shpk","sh","p","k","kosovo","kosove"]);
const words=(value:string):string[]=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().match(/[a-z0-9]+/g)??[];
export const normalizeWorkshopPhone=(phone:string)=>{let n=phone.replace(/\D/g,"");if(n.startsWith("00"))n=n.slice(2);return n;};
export function validGooglePlaceId(id:unknown):id is string{return typeof id==="string"&&/^[A-Za-z0-9_-]{10,255}$/.test(id);}
export function verifiedGooglePlace(workshop:Identity,candidates:GooglePlaceCandidate[]):string|null{
 const distinctive=words(workshop.name).filter(word=>!generic.has(word));
 const matches=candidates.filter(place=>{
  if(!validGooglePlaceId(place.id)||!workshop.phone||normalizeWorkshopPhone(place.internationalPhoneNumber??"")!==normalizeWorkshopPhone(workshop.phone))return false;
  const country=place.addressComponents?.find(component=>component.types?.includes("country"));
  if(country?.shortText!=="XK"&&!words(country?.longText??"").some(word=>word==="kosovo"||word==="kosove"))return false;
  const name=words(place.displayName?.text??"");
  if(!distinctive.length||!distinctive.some(word=>name.includes(word)))return false;
  const p=place.location;
  if(typeof p?.latitude!=="number"||typeof p.longitude!=="number"||p.latitude<41.8||p.latitude>43.3||p.longitude<19.8||p.longitude>21.9)return false;
  if(workshop.lat!==null&&workshop.lng!==null){
   // Exact known premises must agree; a shared chain phone is insufficient.
   const km=Math.hypot((p.latitude-workshop.lat)*111,(p.longitude-workshop.lng)*82);
   if(km>3)return false;
  }else{
   const cityNames:Record<string,string[]>={Prishtina:["prishtina","prishtine","pristina"],Peja:["peja","peje","pec"],Gjakova:["gjakova","gjakove","djakovica"],Ferizaj:["ferizaj","urosevac"],Mitrovica:["mitrovica","mitrovice"],"Fushë Kosovë":["fushe kosove","fushe kosovo","kosovo polje"],"Graçanicë":["gracanice","gracanica"],"Klinë":["kline","klina"],"Deçan":["decan","decani"]};
   const address=` ${words(place.formattedAddress??"").join(" ")} `;
   if(!(cityNames[workshop.city]??[words(workshop.city).join(" ")]).some(city=>address.includes(` ${city} `)))return false;
  }
  return true;
 });
 const ids=[...new Set(matches.map(place=>place.id!))];
 return ids.length===1?ids[0]:null;
}
export async function workshopIdentityHash(w:Identity){const input=JSON.stringify([w.name,w.phone,w.city,w.address,w.lat,w.lng]);const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");}
