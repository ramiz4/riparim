import {catalogueHref,parseCatalogueFilters} from "@/lib/catalogue-filters";
import type {Workshop} from "@/lib/workshops";

export function profileSearchHref(value:string|null,directory:Workshop[]){
 if(!value?.startsWith("/")||value.startsWith("//"))return null;
 try{
  const url=new URL(value,"https://riparim.invalid");
  if(url.origin!=="https://riparim.invalid"||url.pathname!=="/werkstaetten")return null;
  return catalogueHref(parseCatalogueFilters(url.searchParams,directory));
 }catch{return null;}
}

type Navigation={readHref:()=>string;navigate:(href:string)=>void;hardNavigate:(href:string)=>void;schedule:(callback:()=>void,delay:number)=>()=>void};
let cancelActive:(()=>void)|null=null;

// Keep the private search draft during normal navigation. If the client router
// stalls, fall back to loading the same public profile as a normal document.
export function navigateToProfile(href:string,navigation:Navigation){
 cancelActive?.();
 const from=navigation.readHref();
 let cancelled=false;
 const stopTimer=navigation.schedule(()=>{
  if(cancelled)return;
  cancelled=true;
  if(cancelActive===cancel)cancelActive=null;
  if(navigation.readHref()===from)navigation.hardNavigate(href);
 },7000);
 function cancel(){cancelled=true;stopTimer();if(cancelActive===cancel)cancelActive=null;}
 cancelActive=cancel;
 try{navigation.navigate(href);}catch{cancel();navigation.hardNavigate(href);}
 return cancel;
}
