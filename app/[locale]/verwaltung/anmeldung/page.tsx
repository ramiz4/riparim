import {I18nMessages} from "@/lib/i18n/client";
import {createTranslator} from "@/lib/i18n/messages";
import {managementMessages,managementMetadata} from "@/lib/i18n/management";
import {callbackLocale} from "@/lib/auth/locale";
import {isLocale,localizeHref} from "@/lib/i18n/locale";
import {LocaleAnchor} from "@/components/locale-anchor";
import Link from "@/components/locale-link";
import {getAdminUser} from "@/app/auth";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import AuthSetup from "./setup";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale:value}=await params,locale=isLocale(value)?value:"de";const u=await getAdminUser();const messages=managementMessages(locale,false),t=createTranslator(messages);if(!u?.isModerator)return <I18nMessages messages={messages}><main className="access-page"><h1>{t("management.ownerRequired")}</h1><p>{t("management.authAccessHelp")}</p><LocaleAnchor className="primary" href={chatGPTSignInPath(localizeHref("/verwaltung/anmeldung",locale))} target="_top">{t("management.ownerChatGPT")}</LocaleAnchor><Link href="/">{t("management.backSearch")}</Link></main></I18nMessages>;return <I18nMessages messages={messages}><AuthSetup account={{email:u.email,displayName:u.displayName,provider:u.provider}}/></I18nMessages>;}

export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;return managementMetadata(callbackLocale(locale),"login");}
