import type {ReactNode} from "react";
import {LocaleAnchor} from "@/components/locale-anchor";
import {privacyContactAddress,type PrivacyMessageCatalog} from "@/lib/i18n/privacy-messages";
function rich(text:string,slots:Record<string,ReactNode>):ReactNode{return text.split(/(\{[a-zA-Z]+\})/).map((part,index)=>part.startsWith("{")?<span key={index}>{slots[part.slice(1,-1)]}</span>:part);}
const sections=[['account',3],['cookies',3],['locale',1],['reviews',3],['notifications',3],['business',2],['storage',1],['google',3],['deletion',5]] as const;
export function PrivacyContent({text,authProvider="supabase"}:{text:PrivacyMessageCatalog;authProvider?:"supabase"|"pocketbase"}){
 const contact=<LocaleAnchor href={`mailto:${privacyContactAddress}`}>{privacyContactAddress}</LocaleAnchor>;
 const slots={contact,openid:<code>openid</code>,email:<code>email</code>,profile:<code>profile</code>,publishedFields:<strong>{text.reviewsPublicFields}</strong>,google:<LocaleAnchor href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google</LocaleAnchor>,authProvider:<LocaleAnchor href={authProvider==="pocketbase"?"https://pocketbase.io/docs/authentication/":"https://supabase.com/privacy"} target="_blank" rel="noopener noreferrer">{authProvider==="pocketbase"?"PocketBase":"Supabase"}</LocaleAnchor>};
 return <main className="privacy-page"><h1>{text.title}</h1><p className="privacy-date">{text.date}</p><p>{rich(text.contact,slots)}</p>{sections.map(([name,count])=><section key={name} aria-labelledby={`privacy-${name}`}><h2 id={`privacy-${name}`}>{text[`${name}Heading`]}</h2>{Array.from({length:count},(_,i)=><p key={i}>{rich(text[`${name}${i+1}` as keyof PrivacyMessageCatalog],slots)}</p>)}</section>)}</main>;
}
