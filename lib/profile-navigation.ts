import {localeFromPath,localizeHref,stripLocalePrefix} from "@/lib/i18n/locale";
import {catalogueHref,parseCatalogueFilters} from "@/lib/catalogue-filters";
import type {Workshop} from "@/lib/workshops";

export function profileSearchHref(value:string|null,directory:Workshop[]){
 if(!value?.startsWith("/")||value.startsWith("//"))return null;
 try{
  const url=new URL(value,"https://riparim.invalid");
  if(url.origin!=="https://riparim.invalid"||stripLocalePrefix(url.pathname)!=="/werkstaetten")return null;
  return localizeHref(catalogueHref(parseCatalogueFilters(url.searchParams,directory)),localeFromPath(url.pathname));
 }catch{return null;}
}

type Navigation={readHref:()=>string;isPageReady?:(href:string)=>boolean;navigate:(href:string)=>void;hardNavigate:(href:string)=>void;schedule:(callback:()=>void,delay:number)=>()=>void};
let cancelActive:(()=>void)|null=null;

// Keep the private search draft during normal navigation. If the client router
// stalls, load the requested profile or search as a normal document. A changed
// URL alone does not mean the destination page has actually rendered.
export function navigateToWorkshopPage(href:string,navigation:Navigation){
 cancelActive?.();
 const from=navigation.readHref(),target=new URL(href,from).href;
 let cancelled=false;
 const stopTimer=navigation.schedule(()=>{
  if(cancelled)return;
  cancelled=true;
  if(cancelActive===cancel)cancelActive=null;
  const current=navigation.readHref();
  if(current===from||(current===target&&navigation.isPageReady?.(href)===false))navigation.hardNavigate(href);
 },2000);
 function cancel(){cancelled=true;stopTimer();if(cancelActive===cancel)cancelActive=null;}
 cancelActive=cancel;
 try{navigation.navigate(href);}catch{cancel();navigation.hardNavigate(href);}
 return cancel;
}
