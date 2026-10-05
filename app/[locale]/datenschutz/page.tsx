import type {ReactNode} from "react";
import {LocaleAnchor} from "@/components/locale-anchor";
import {getAppUser,getAdminUser} from "@/app/auth";
import {SiteHeader} from "@/components/site-header";
import {DirectoryFooter} from "@/components/directory-footer";
import {isLocale} from "@/lib/i18n/locale";
import {I18nMessages} from "@/lib/i18n/client";
import {getMessages} from "@/lib/i18n/messages";
import {privacyMessages,privacyContactAddress,type PrivacyMessageCatalog} from "@/lib/i18n/privacy-messages";
import {publicMetadata} from "@/lib/i18n/public-metadata";
import {siteOrigin} from "@/lib/auth/config";
import "./privacy.css";
export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale:value}=await params,locale=isLocale(value)?value:"de",text=privacyMessages[locale];return publicMetadata(locale,"/datenschutz",siteOrigin(),{title:text.metadataTitle,description:text.metadataDescription});}
function rich(text:string,slots:Record<string,ReactNode>):ReactNode{return text.split(/(\{[a-zA-Z]+\})/).map((part,index)=>part.startsWith("{")?<span key={index}>{slots[part.slice(1,-1)]}</span>:part);}
const sections=[['account',3],['cookies',3],['locale',1],['reviews',3],['notifications',3],['business',2],['storage',1],['google',3],['deletion',5]] as const;
export function PrivacyContent({text}:{text:PrivacyMessageCatalog}){
 const contact=<LocaleAnchor href={`mailto:${privacyContactAddress}`}>{privacyContactAddress}</LocaleAnchor>;
 const slots={contact,openid:<code>openid</code>,email:<code>email</code>,profile:<code>profile</code>,publishedFields:<strong>{text.reviewsPublicFields}</strong>,google:<LocaleAnchor href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google</LocaleAnchor>,supabase:<LocaleAnchor href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase</LocaleAnchor>};
 return <main className="privacy-page"><h1>{text.title}</h1><p className="privacy-date">{text.date}</p><p>{rich(text.contact,slots)}</p>{sections.map(([name,count])=><section key={name} aria-labelledby={`privacy-${name}`}><h2 id={`privacy-${name}`}>{text[`${name}Heading`]}</h2>{Array.from({length:count},(_,i)=><p key={i}>{rich(text[`${name}${i+1}` as keyof PrivacyMessageCatalog],slots)}</p>)}</section>)}</main>;
}
export default async function PrivacyPage({params}:{params:Promise<{locale:string}>}){
 const {locale:value}=await params,locale=isLocale(value)?value:"de",user=await getAppUser(),admin=await getAdminUser(user);
 return <I18nMessages messages={getMessages(locale,["public"])}><SiteHeader account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/><PrivacyContent text={privacyMessages[locale]}/><DirectoryFooter/></I18nMessages>;
}
