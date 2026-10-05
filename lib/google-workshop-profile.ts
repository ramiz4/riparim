import type {Locale} from "./i18n/locale";
import {intlLocales} from "./i18n/format";
import {googleMapsPlaceUrl} from "./google-maps-link";
import type {LiveGoogleRating} from "./google-maps-browser";

export type GoogleProfileStatus="loading"|"ready"|"unavailable";
export type GoogleHours={openNow:boolean|null;weekdays:string[];nextOpenTime:string|null;nextCloseTime:string|null;periods:GooglePeriod[]};
export type GooglePhoto={resource:string;authors:{name:string;url:string|null}[];mapsUrl:string|null};
export type LiveGoogleProfile={placeId:string;rating:LiveGoogleRating;hours:GoogleHours;businessStatus:string|null;location:{lat:number;lng:number}|null;photos:GooglePhoto[];loadedAt:number};
export type GooglePoint={day:number;hour:number;minute:number;date?:{year:number;month:number;day:number}};
export type GooglePeriod={open:GooglePoint;close?:GooglePoint};
type HoursResponse={periods?:GooglePeriod[];openNow?:boolean;weekdayDescriptions?:string[];nextOpenTime?:string;nextCloseTime?:string};
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
  hours:{openNow:typeof current?.openNow==="boolean"?current.openNow:null,weekdays:weekdays.filter(value=>typeof value==="string").slice(0,7),nextOpenTime:validTimestamp(current?.nextOpenTime),nextCloseTime:validTimestamp(current?.nextCloseTime),periods:safePeriods(current?current.periods:body.regularOpeningHours?.periods)},
  photos:(body.photos??[]).filter(p=>typeof p.name==="string"&&p.name.startsWith(`places/${placeId}/photos/`)&&/^[A-Za-z0-9_/-]+$/.test(p.name)).slice(0,3).map(p=>({resource:p.name!,mapsUrl:safeGoogleHttps(p.googleMapsUri),authors:(p.authorAttributions??[]).filter(a=>a.displayName).map(a=>({name:a.displayName!,url:safeGoogleHttps(a.uri)}))}))};
}
export function googlePhotoUrl(photo:GooglePhoto,browserKey:string,size:"preview"|"large"="preview"){return `https://places.googleapis.com/v1/${photo.resource}/media?${new URLSearchParams({maxWidthPx:size==="large"?"1600":"1000",maxHeightPx:size==="large"?"1200":"700",key:browserKey})}`;}
export function googleRatingEmptyLabel(live:LiveGoogleRating|null|undefined,status:GoogleProfileStatus|"idle"):"public.googleNoReviews"|"public.googleNoRating"|"public.googleUnavailable"|"public.googleLoading"{
 if(live?.count===0)return "public.googleNoReviews";
 if(live)return "public.googleNoRating";
 return status==="unavailable"?"public.googleUnavailable":"public.googleLoading";
}
function validPoint(point:GooglePoint|undefined):point is GooglePoint{
 if(!point||!Number.isInteger(point.day)||point.day<0||point.day>6||!Number.isInteger(point.hour)||point.hour<0||point.hour>23||!Number.isInteger(point.minute)||point.minute<0||point.minute>59)return false;
 if(!point.date)return true;
 const {year,month,day}=point.date;if(!Number.isInteger(year)||!Number.isInteger(month)||!Number.isInteger(day))return false;
 const date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
function safePeriods(periods:GooglePeriod[]|undefined):GooglePeriod[]{return Array.isArray(periods)?periods.filter(p=>validPoint(p?.open)&&(!p.close||validPoint(p.close))).slice(0,32):[];}
const dayKey=(date:Date)=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);return ["year","month","day"].map(type=>parts.find(part=>part.type===type)!.value).join("-");};
const tomorrowKey=(date:Date)=>{const [year,month,day]=dayKey(date).split("-").map(Number);return dayKey(new Date(Date.UTC(year,month-1,day+1,12)));};
export function googleProfileRefreshDelay(profile:LiveGoogleProfile,now=Date.now()){
 const next=profile.hours.openNow?profile.hours.nextCloseTime:profile.hours.nextOpenTime;
 const remaining=next?Date.parse(next)-now:NaN;
 return Number.isFinite(remaining)&&remaining>0?Math.min(1800000,remaining+1500):300000;
}
// Weekday descriptions may be in any provider fallback language and order.
// Only structured periods can describe today; provider text stays untouched.
function todayIntervals(periods:GooglePeriod[],now:Date):string|null{
 const key=dayKey(now),date=new Date(`${key}T12:00:00Z`),weekday=date.getUTCDay(),dayMinutes=weekday*1440;
 const pointDay=(p:GooglePoint)=>p.date?`${p.date.year}-${String(p.date.month).padStart(2,"0")}-${String(p.date.day).padStart(2,"0")}`:null;
 const minuteText=(minute:number)=>`${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;
 const intervals:string[]=[];
 for(const period of periods){
  const {open,close}=period;
  if(!close){if(open.day===0&&open.hour===0&&open.minute===0)intervals.push("00:00–24:00");continue;}
  let start:number,end:number;
  if(open.date||close.date){
   if(!open.date||!close.date)continue;
   start=(Date.parse(`${pointDay(open)}T12:00:00Z`)-date.getTime())/60000+open.hour*60+open.minute;
   end=(Date.parse(`${pointDay(close)}T12:00:00Z`)-date.getTime())/60000+close.hour*60+close.minute;
  }else{
   start=open.day*1440+open.hour*60+open.minute-dayMinutes;end=close.day*1440+close.hour*60+close.minute-dayMinutes;
   if(end<=start)end+=10080;
   if(start>1440){start-=10080;end-=10080;}
  }
  if(end<=start||end<=0||start>=1440)continue;
  intervals.push(`${minuteText(Math.max(0,start))}–${Math.min(1440,end)===1440?"24:00":minuteText(Math.min(1440,end))}`);
 }
 return intervals.length?[...new Set(intervals)].join(", "):null;
}
export function googleOpeningPresentation(profile:LiveGoogleProfile|null,status:GoogleProfileStatus,now=new Date(),locale:Locale="de"){
 const rows=(profile?.hours.weekdays??[]).map(value=>({day:value,text:"",today:false}));
 const today=profile?todayIntervals(profile.hours.periods??[],now):null;
 const result=(label:"public.hoursFailed"|"public.hoursLoading"|"public.closedPermanently"|"public.closedTemporarily"|"public.openNow"|"public.closedNow"|"public.hours"|"public.noHours",tone:"neutral"|"open"|"closed",detail:{message:"public.openUntil"|"public.opensAt";when:"public.today"|"public.tomorrow"|"public.sunday"|"public.monday"|"public.tuesday"|"public.wednesday"|"public.thursday"|"public.friday"|"public.saturday";time:string}|null=null)=>({label,detail,tone,today,rows});
 if(!profile)return result(status==="unavailable"?"public.hoursFailed":"public.hoursLoading","neutral");
 if(profile.businessStatus==="CLOSED_PERMANENTLY"||profile.businessStatus==="CLOSED_TEMPORARILY")return {...result(profile.businessStatus==="CLOSED_PERMANENTLY"?"public.closedPermanently":"public.closedTemporarily","closed"),today:null,rows:[]};
 const open=profile.hours.openNow,transition=open?profile.hours.nextCloseTime:profile.hours.nextOpenTime;
 let detail:{message:"public.openUntil"|"public.opensAt";when:"public.today"|"public.tomorrow"|"public.sunday"|"public.monday"|"public.tuesday"|"public.wednesday"|"public.thursday"|"public.friday"|"public.saturday";time:string}|null=null;
 if(transition&&Date.parse(transition)>now.getTime()){
  const date=new Date(transition),requested=intlLocales[locale],supported=Intl.DateTimeFormat.supportedLocalesOf([requested]).length?requested:"de-DE";
  const time=new Intl.DateTimeFormat(supported,{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(date);
  const when=dayKey(date)===dayKey(now)?"public.today":dayKey(date)===tomorrowKey(now)?"public.tomorrow":(["public.sunday","public.monday","public.tuesday","public.wednesday","public.thursday","public.friday","public.saturday"] as const)[new Date(`${dayKey(date)}T12:00:00Z`).getUTCDay()];
  detail={message:open?"public.openUntil":"public.opensAt",when,time};
 }
 return result(open===true?"public.openNow":open===false?"public.closedNow":rows.length?"public.hours":"public.noHours",open===true?"open":open===false?"closed":"neutral",detail);
}
