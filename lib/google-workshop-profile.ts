import {googleMapsPlaceUrl} from "./google-maps-link";
import type {LiveGoogleRating} from "./google-maps-browser";

export type GoogleProfileStatus="loading"|"ready"|"unavailable";
export type GoogleHours={openNow:boolean|null;weekdays:string[];nextOpenTime:string|null;nextCloseTime:string|null};
export type GooglePhoto={resource:string;authors:{name:string;url:string|null}[];mapsUrl:string|null};
export type LiveGoogleProfile={placeId:string;rating:LiveGoogleRating;hours:GoogleHours;businessStatus:string|null;location:{lat:number;lng:number}|null;photos:GooglePhoto[];loadedAt:number};
type HoursResponse={openNow?:boolean;weekdayDescriptions?:string[];nextOpenTime?:string;nextCloseTime?:string};
export type GoogleProfileResponse={id?:string;rating?:number;userRatingCount?:number;googleMapsUri?:string;currentOpeningHours?:HoursResponse;regularOpeningHours?:HoursResponse;businessStatus?:string;location?:{latitude?:number;longitude?:number};photos?:{name?:string;googleMapsUri?:string;authorAttributions?:{displayName?:string;uri?:string}[]}[];attributions?:{provider?:string;providerUri?:string}[]};
const zone="Europe/Belgrade";
export function safeGoogleHttps(value:string|undefined):string|null{
 try{const u=new URL(value?.startsWith("//")?`https:${value}`:value??"");return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
const validTimestamp=(value:string|undefined)=>value&&Number.isFinite(Date.parse(value))?value:null;
export function normalizeGoogleProfile(body:GoogleProfileResponse,placeId:string,now=Date.now()):LiveGoogleProfile{
 if(body.id!==placeId)throw Error("Google identity changed");
 const current=body.currentOpeningHours,weekdays=current?.weekdayDescriptions?.length?current.weekdayDescriptions:body.regularOpeningHours?.weekdayDescriptions??[];
 const coordinate=body.location;
 const location=typeof coordinate?.latitude==="number"&&typeof coordinate.longitude==="number"&&Number.isFinite(coordinate.latitude)&&Number.isFinite(coordinate.longitude)&&coordinate.latitude>=41.8&&coordinate.latitude<=43.3&&coordinate.longitude>=19.8&&coordinate.longitude<=21.9?{lat:coordinate.latitude,lng:coordinate.longitude}:null;
 const mapsUrl=safeGoogleHttps(body.googleMapsUri)??googleMapsPlaceUrl(placeId,"Werkstatt");
 return {placeId,loadedAt:now,businessStatus:body.businessStatus??null,location,
  rating:{rating:typeof body.rating==="number"&&body.rating>=1&&body.rating<=5?body.rating:null,count:Number.isInteger(body.userRatingCount)&&body.userRatingCount!>=0?body.userRatingCount!:null,mapsUrl,attributions:(body.attributions??[]).filter(a=>a.provider).map(a=>({provider:a.provider,providerURI:safeGoogleHttps(a.providerUri)??undefined}))},
  hours:{openNow:typeof current?.openNow==="boolean"?current.openNow:null,weekdays:weekdays.filter(value=>typeof value==="string").slice(0,7),nextOpenTime:validTimestamp(current?.nextOpenTime),nextCloseTime:validTimestamp(current?.nextCloseTime)},
  photos:(body.photos??[]).filter(p=>typeof p.name==="string"&&p.name.startsWith(`places/${placeId}/photos/`)&&/^[A-Za-z0-9_/-]+$/.test(p.name)).slice(0,3).map(p=>({resource:p.name!,mapsUrl:safeGoogleHttps(p.googleMapsUri),authors:(p.authorAttributions??[]).filter(a=>a.displayName).map(a=>({name:a.displayName!,url:safeGoogleHttps(a.uri)}))}))};
}
export function googlePhotoUrl(photo:GooglePhoto,browserKey:string){return `https://places.googleapis.com/v1/${photo.resource}/media?${new URLSearchParams({maxWidthPx:"1000",maxHeightPx:"700",key:browserKey})}`;}
export function googleRatingEmptyLabel(live:LiveGoogleRating|null|undefined,status:GoogleProfileStatus|"idle"){
 if(live?.count===0)return "Noch keine Google-Rezensionen";
 if(live)return "Keine Google-Bewertung hinterlegt";
 return status==="unavailable"?"Google konnte nicht geladen werden":"Google wird geladen …";
}
const dayKey=(date:Date)=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);return ["year","month","day"].map(type=>parts.find(part=>part.type===type)!.value).join("-");};
const tomorrowKey=(date:Date)=>{const [year,month,day]=dayKey(date).split("-").map(Number);return dayKey(new Date(Date.UTC(year,month-1,day+1,12)));};
export function googleProfileRefreshDelay(profile:LiveGoogleProfile,now=Date.now()){
 const next=profile.hours.openNow?profile.hours.nextCloseTime:profile.hours.nextOpenTime;
 const remaining=next?Date.parse(next)-now:NaN;
 return Number.isFinite(remaining)&&remaining>0?Math.min(1800000,remaining+1500):300000;
}
export function googleOpeningPresentation(profile:LiveGoogleProfile|null,status:GoogleProfileStatus,now=new Date()){
 const day=new Intl.DateTimeFormat("de-DE",{timeZone:zone,weekday:"long"}).format(now);
 const rows=(profile?.hours.weekdays??[]).map(value=>{const colon=value.indexOf(":");return {day:colon>=0?value.slice(0,colon).trim():value,text:colon>=0?value.slice(colon+1).trim():"",today:value.toLocaleLowerCase("de").startsWith(day.toLocaleLowerCase("de")+":")};});
 const today=rows.find(row=>row.today)?.text??null;
 if(!profile)return {label:status==="unavailable"?"Öffnungszeiten konnten nicht geladen werden":"Öffnungszeiten werden geladen …",detail:null,tone:"neutral",today,rows};
 if(profile.businessStatus==="CLOSED_PERMANENTLY"||profile.businessStatus==="CLOSED_TEMPORARILY")return {label:profile.businessStatus==="CLOSED_PERMANENTLY"?"Dauerhaft geschlossen":"Vorübergehend geschlossen",detail:null,tone:"closed",today:null,rows:[]};
 const open=profile.hours.openNow,transition=open?profile.hours.nextCloseTime:profile.hours.nextOpenTime;
 let detail:string|null=null;
 if(transition&&Date.parse(transition)>now.getTime()){
  const date=new Date(transition),time=new Intl.DateTimeFormat("de-DE",{timeZone:zone,hour:"2-digit",minute:"2-digit"}).format(date);
  const when=dayKey(date)===dayKey(now)?"heute":dayKey(date)===tomorrowKey(now)?"morgen":new Intl.DateTimeFormat("de-DE",{timeZone:zone,weekday:"long"}).format(date);
  detail=open?`Bis ${when} ${time} Uhr`:`Öffnet ${when} um ${time} Uhr`;
 }
 return {label:open===true?"Jetzt geöffnet":open===false?"Jetzt geschlossen":rows.length?"Öffnungszeiten":"Keine Öffnungszeiten hinterlegt",detail,tone:open===true?"open":open===false?"closed":"neutral",today,rows};
}
