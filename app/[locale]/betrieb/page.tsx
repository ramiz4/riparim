import {I18nMessages} from "@/lib/i18n/client";
import {createTranslator} from "@/lib/i18n/messages";
import {managementMessages,managementMetadata} from "@/lib/i18n/management";
import {callbackLocale} from "@/lib/auth/locale";

import Link from "@/components/locale-link";
import {getAppUser,getAdminUser} from "@/app/auth";
import {listWorkshops} from "@/db/directory";
import {SiteHeader} from "@/components/site-header";
import {DirectoryFooter} from "@/components/directory-footer";
import {BusinessPanel} from "@/components/business-panel";
import "./business.css";

export const dynamic="force-dynamic";

export default async function BusinessPage({searchParams,params}:{params:Promise<{locale:string}>;searchParams:Promise<{werkstatt?:string|string[]}>}){
 const {locale:value}=await params,locale=callbackLocale(value);
 const user=await getAppUser(),admin=await getAdminUser(user),query=await searchParams;
 const workshopId=typeof query.werkstatt==="string"?query.werkstatt:undefined;
 const directory=user&&workshopId?(await listWorkshops()).filter(workshop=>workshop.id===workshopId):[];const messages=managementMessages(locale,true),t=createTranslator(messages);
 return <I18nMessages messages={messages}><><SiteHeader account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/><main className="business-page wrap">{!user&&<><h1>{t("management.myBusiness")}</h1><p>{t("management.businessIntro")}</p></>}{user?<BusinessPanel directory={directory} initialWorkshop={workshopId}/>:<p><Link className="primary" href={`/anmelden?weiter=${encodeURIComponent(`/betrieb${workshopId?`?werkstatt=${encodeURIComponent(workshopId)}`:""}`)}`}>{t("management.login")}</Link> {t("management.businessLogin")}</p>}</main><DirectoryFooter/></></I18nMessages>;
}

export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;return managementMetadata(callbackLocale(locale),"business");}
