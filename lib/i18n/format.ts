import {defaultLocale,isLocale,type Locale} from "./locale";

export const intlLocales={de:"de-DE",sq:"sq-AL",en:"en-GB"} as const;
export const kosovoTimeZone="Europe/Belgrade";
export function formatNumber(locale:Locale,value:number):string{
 if(!Number.isFinite(value))return "—";
 const active=isLocale(locale)?locale:defaultLocale;
 // Local workerd ships sq plural rules but omits its number/date ICU data.
 // Native Intl still performs rounding/grouping; only sq separators need a fallback.
 if(active==="sq"&&!Intl.NumberFormat.supportedLocalesOf([intlLocales.sq]).length){
  const parts=new Intl.NumberFormat("en-GB").formatToParts(value),grouped=parts.filter(part=>part.type==="integer").map(part=>part.value).join("").length>=5;
  return parts.map(part=>part.type==="decimal"?",":part.type==="group"?grouped?"\u00a0":"":part.value).join("");
 }
 return new Intl.NumberFormat(intlLocales[active]).format(value);
}
export function formatDate(locale:Locale,value:string|number|Date,{dateOnly=false,withTime=false}:{dateOnly?:boolean;withTime?:boolean}={}):string{
 let date:Date;
 if(dateOnly){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return "—";
  date=new Date(`${value}T12:00:00Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return "—";
 }else date=new Date(value);
 if(!Number.isFinite(date.getTime()))return "—";
 const active=isLocale(locale)?locale:defaultLocale,requested=intlLocales[active];
 const supported=Intl.DateTimeFormat.supportedLocalesOf([requested]).length?requested:active==="sq"?"de-DE":requested;
 return new Intl.DateTimeFormat(supported,{
  day:"2-digit",month:"2-digit",year:"numeric",...(withTime?{hour:"2-digit",minute:"2-digit"} as const:{}),timeZone:dateOnly?"UTC":kosovoTimeZone
 }).format(date);
}
