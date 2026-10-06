import {validatedReturnPath} from "@/lib/auth/return-path";
import {localizeHref,stripLocalePrefix,type Locale} from "./locale";
import {catalogueQuery} from "@/lib/catalogue-filters";

const origin="https://riparim.invalid";
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const profileId=/^[a-z0-9][a-z0-9-]{2,80}$/;
const publicHashes=new Set(["#bewerten","#leistungen","#bewertungen","#standort","#fotos","#konto","#suche","#so-gehts","#quellen","#google-bewertungen","#privacy-account","#privacy-cookies","#privacy-reviews","#privacy-notifications","#privacy-business","#privacy-storage","#privacy-google","#privacy-deletion"]);
// Language switches carry only public navigation fields, never arbitrary URL data.
export function languageSwitchHref(href:string,locale:Locale):string {return publicNavigationHref(href,locale,true);}
function publicNavigationHref(href:string,locale:Locale,allowReturn:boolean):string {
 if(!href.startsWith("/")||href.startsWith("//"))return localizeHref("/",locale);
 let url:URL;try{url=new URL(href,origin);}catch{return localizeHref("/",locale);}
 if(url.origin!==origin||url.username||url.password)return localizeHref("/",locale);
 const path=stripLocalePrefix(url.pathname),query=new URLSearchParams();
 if(/^\/(?:api|auth|signin-with-chatgpt|signout-with-chatgpt|callback|__sites_connector_preview|__migration|_next)(?:\/|$)/.test(path)||/\.[a-z0-9]+$/i.test(path))return localizeHref("/",locale);
 if(path==="/werkstaetten"){
  if(url.searchParams.get("bewerten")==="1")query.set("bewerten","1");
  const name=catalogueQuery(url.searchParams.get("q")??"");if(name)query.set("q",name);
  for(const key of ["leistung","ort","marke","sprache","sort"]){const value=url.searchParams.get(key);if(value&&slug.test(value)&&value.length<=100)query.set(key,value);}
 }
 if(path==="/"){
  if(url.searchParams.get("besuche")==="1")query.set("besuche","1");
  const workshop=url.searchParams.get("nachweis");if(workshop&&profileId.test(workshop))query.set("nachweis",workshop);

 }
 if(path==="/betrieb"){const id=url.searchParams.get("werkstatt");if(id&&profileId.test(id))query.set("werkstatt",id);}
 if(/^\/werkstatt\/[^/]+$/.test(path)){
  const search=url.searchParams.get("suche");
  if(search){const target=languageSwitchHref(search,locale);if(stripLocalePrefix(target).startsWith("/werkstaetten"))query.set("suche",target);}
  if(url.searchParams.get("bewerten")==="1")query.set("bewerten","1");
 }
 if(["/anmelden","/registrieren","/passwort-vergessen","/passwort-neu"].includes(path)){
  const next=url.searchParams.get("weiter");
  if(allowReturn&&next&&next.length<=2000){const safe=validatedReturnPath(next,origin,"");if(safe)query.set("weiter",publicNavigationHref(safe,locale,false));}
 }
 return localizeHref(`${path}${query.size?`?${query}`:""}${publicHashes.has(url.hash)?url.hash:""}`,locale);
}
