import {defaultLocale,isLocale,localizeHref,type Locale} from "@/lib/i18n/locale";
import {validatedReturnPath} from "./return-path";

export function requestLocale(value:unknown):Locale|null{return value===undefined?defaultLocale:isLocale(value)?value:null;}
export function callbackLocale(value:unknown):Locale{return isLocale(value)?value:defaultLocale;}
export function localizedReturnPath(value:unknown,origin:string,locale:Locale,fallback="/?besuche=1"){
 return localizeHref(validatedReturnPath(value,origin,fallback),locale);
}
// The locale-first query is shared with the hosted Auth mail templates.
export function authCallbackUrl(origin:string,locale:Locale,returnTo:unknown,parameters:Record<string,string>={}){
 const url=new URL("/auth/bestaetigen",origin);
 url.searchParams.set("locale",locale);
 url.searchParams.set("weiter",localizedReturnPath(returnTo,origin,locale));
 for(const [key,value] of Object.entries(parameters))if(["anbieter","fluss","token_hash","type","code"].includes(key))url.searchParams.set(key,value);
 return url.href;
}
