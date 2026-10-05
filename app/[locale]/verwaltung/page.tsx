import {I18nMessages} from "@/lib/i18n/client";
import {createTranslator} from "@/lib/i18n/messages";
import {managementMessages,managementMetadata} from "@/lib/i18n/management";
import {callbackLocale} from "@/lib/auth/locale";
import {isLocale,localizeHref} from "@/lib/i18n/locale";
import {LocaleAnchor} from "@/components/locale-anchor";
import Link from "@/components/locale-link";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import {getAdminUser} from "@/app/auth";
import AdminPanel from "./panel";
export const dynamic="force-dynamic";
export default async function AdminPage({params}:{params:Promise<{locale:string}>}){const {locale:value}=await params,locale=isLocale(value)?value:"de";const user=await getAdminUser();const messages=managementMessages(locale,false),t=createTranslator(messages);if(!user)return <I18nMessages messages={messages}><main className="access-page"><h1>{t("management.workshopAdministration")}</h1><p>{t("management.adminLoginHelp")}</p><LocaleAnchor className="primary" href={chatGPTSignInPath(localizeHref("/verwaltung",locale))} target="_top">{t("management.chatGPTLogin")}</LocaleAnchor><Link href="/">{t("management.backSearch")}</Link></main></I18nMessages>;if(!user.isModerator)return <I18nMessages messages={messages}><main className="access-page"><h1>{t("management.noAdministration")}</h1><p>{t("management.customerHelp")}</p><Link className="primary" href="/">{t("management.backWorkshops")}</Link></main></I18nMessages>;return <I18nMessages messages={messages}><AdminPanel account={{email:user.email,displayName:user.displayName,provider:user.provider}}/></I18nMessages>;}

export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;return managementMetadata(callbackLocale(locale),"workshops");}
