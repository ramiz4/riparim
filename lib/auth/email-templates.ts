import {emailCopy,emailHtml} from "@/lib/email-content";
import type {Locale} from "@/lib/i18n/locale";

// Supabase parses both subject and body with Go html/template and no custom
// functions. `and` short-circuits before slice; legacy links remain German.
const localeGuard='{{ $sq := printf "%s/auth/bestaetigen?locale=sq&" .SiteURL }}{{ $en := printf "%s/auth/bestaetigen?locale=en&" .SiteURL }}';
function localizedTemplate(render:(locale:Locale)=>string){
 return `${localeGuard}{{ if and (ge (len .RedirectTo) (len $sq)) (eq (slice .RedirectTo 0 (len $sq)) $sq) }}${render("sq")}{{ else if and (ge (len .RedirectTo) (len $en)) (eq (slice .RedirectTo 0 (len $en)) $en) }}${render("en")}{{ else }}${render("de")}{{ end }}`;
}
export const confirmationEmailSubject=localizedTemplate(locale=>emailCopy[locale].confirmation.title);
export const recoveryEmailSubject=localizedTemplate(locale=>emailCopy[locale].recovery.title);
// Auth requests provide locale FIRST and a `weiter` query. Token hash and type
// continue to reach the stable physical callback; Go escapes dynamic values.
export const confirmationEmailTemplate=localizedTemplate(locale=>emailHtml(locale,emailCopy[locale].confirmation,"{{ .RedirectTo }}&token_hash={{ .TokenHash | urlquery }}&type=signup"));
export const recoveryEmailTemplate=localizedTemplate(locale=>emailHtml(locale,emailCopy[locale].recovery,"{{ .RedirectTo }}&token_hash={{ .TokenHash | urlquery }}&type=recovery"));

export function validateAuthEmailOrigins(applicationOrigin:string,providerSiteURL:string){
 const canonical=(value:string)=>{
  let url:URL;try{url=new URL(value);}catch{throw Error("AUTH_EMAIL_ORIGIN_NOT_CANONICAL");}
  const local=url.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(url.hostname);
  if((url.protocol!=="https:"&&!local)||url.username||url.password||value!==url.origin)throw Error("AUTH_EMAIL_ORIGIN_NOT_CANONICAL");
  return url.origin;
 };
 const origin=canonical(applicationOrigin);
 if(canonical(providerSiteURL)!==origin)throw Error("AUTH_EMAIL_ORIGIN_MISMATCH");
 return origin;
}
