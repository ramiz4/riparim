import {stripLocalePrefix} from "../i18n/locale";
// One pure boundary is used by auth and by public locale navigation.
export function validatedReturnPath(value:unknown,origin:string,fallback="/?besuche=1"):string{
 if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//")||/[\u0000-\u001f\u007f\\]/.test(value))return fallback;
 try{
  const url=new URL(value,origin),decoded=decodeURIComponent(url.pathname);
  if(/[\u0000-\u001f\u007f\\]/.test(decoded))return fallback;
  const path=stripLocalePrefix(decoded);
  return url.origin===origin&&!/^\/(?:signin-with-chatgpt|signout-with-chatgpt|callback|auth\/bestaetigen)(?:\/|$)/.test(path)?`${url.pathname}${url.search}${url.hash}`:fallback;
 }catch{return fallback;}
}
