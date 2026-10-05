import type {Metadata} from "next";
import {locales,localizeHref,stripLocalePrefix,type Locale} from "./locale";
export type PublicPageQuery=Record<string,string|string[]|undefined>;
export function isPrivateLandingMode(query:PublicPageQuery):boolean{
 const values=(key:string)=>typeof query[key]==="string"?[query[key]]:query[key]??[];
 return values("besuche").includes("1")||values("einreichung").some(value=>!!value)||values("nachweis").includes("neu");
}
// Canonical and all reciprocal alternatives derive from one clean page identity.
export function publicMetadata(locale:Locale,path:string,origin:string,text:{title:string;description:string},indexable=true):Metadata{
 const identity=stripLocalePrefix(new URL(path,"https://riparim.invalid").pathname).replace(/\/$/,"")||"/";
 const publicPage=["/","/werkstaetten","/datenschutz"].includes(identity)||/^\/werkstatt\/[a-z0-9][a-z0-9-]{2,80}$/.test(identity);
 if(!indexable||!publicPage)return {...text,robots:{index:false,follow:false},alternates:null};
 const base=new URL(origin).origin,absolute=(value:Locale)=>new URL(localizeHref(identity,value),base).href;
 return {...text,alternates:{canonical:absolute(locale),languages:{...Object.fromEntries(locales.map(value=>[value,absolute(value)])),"x-default":absolute("de")}}};
}
