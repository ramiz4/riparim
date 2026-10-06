import {authEmailSubjectCopy,emailCopy,emailHtml} from "@/lib/email-content";
import type {Locale} from "@/lib/i18n/locale";

// Supabase parses both subject and body with Go html/template and no custom
// functions. `and` short-circuits before slice; legacy links remain German.
const localeGuard='{{ $sq := printf "%s/auth/bestaetigen?locale=sq&" .SiteURL }}{{ $en := printf "%s/auth/bestaetigen?locale=en&" .SiteURL }}';
function localizedTemplate(render:(locale:Locale)=>string){
 return `${localeGuard}{{ if and .RedirectTo (ge (len .RedirectTo) (len $sq)) (eq (slice .RedirectTo 0 (len $sq)) $sq) }}${render("sq")}{{ else if and .RedirectTo (ge (len .RedirectTo) (len $en)) (eq (slice .RedirectTo 0 (len $en)) $en) }}${render("en")}{{ else }}${render("de")}{{ end }}`;
}
// Origins are canonical ASCII URL origins (validated below). printf's string
// precision therefore compares the same full prefix as the guarded body slice,
// without risking a slice panic on short/missing RedirectTo or exceeding the
// hosted subject source limit. SQ and EN prefixes have equal length.
function localizedSubject(kind:"confirmation"|"recovery"){
 const copy=authEmailSubjectCopy;
 return `{{$p:=print .SiteURL "/auth/bestaetigen?locale="}}{{$r:=printf "%.*s" (len (print $p "sq&")) .RedirectTo}}Riparim: {{if eq $r (print $p "sq&")}}${copy.sq[kind]}{{else if eq $r (print $p "en&")}}${copy.en[kind]}{{else}}${copy.de[kind]}{{end}}`;
}
export const confirmationEmailSubject=localizedSubject("confirmation");
export const recoveryEmailSubject=localizedSubject("recovery");
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
