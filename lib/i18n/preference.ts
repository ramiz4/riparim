import type {Locale} from "./locale";
import {languageSwitchHref} from "./navigation";
import {localeNoticeCode} from "./codes";

export async function preferredLanguageHref(href:string,locale:Locale,verifiedAccount:boolean):Promise<string>{
 const destination=languageSwitchHref(href,locale);
 if(!verifiedAccount)return destination;
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const saved=await Promise.race([
   fetch("/api/account",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({preferredLocale:locale}),signal:controller.signal}).then(response=>response.ok),
   new Promise<false>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(false);},3000);})
  ]);
  if(saved)return destination;
 }catch{/* A presentation preference must not prevent the requested navigation. */}
 finally{if(timer)clearTimeout(timer);controller.abort();}
 const url=new URL(destination,"https://riparim.invalid");url.searchParams.set("localeNotice",localeNoticeCode);
 return `${url.pathname}${url.search}${url.hash}`;
}
