import {I18nMessages} from "@/lib/i18n/client";
import {createTranslator} from "@/lib/i18n/messages";
import {managementMessages,managementMetadata} from "@/lib/i18n/management";
import {callbackLocale} from "@/lib/auth/locale";
import Link from "@/components/locale-link";
import {getAdminUser} from "@/app/auth";
import {SiteHeader} from "@/components/site-header";
import {AdminNavigation} from "@/components/admin-navigation";
import {BusinessPanel} from "@/components/business-panel";
import "@/app/[locale]/betrieb/business.css";

export const dynamic="force-dynamic";
export default async function BusinessModerationPage({params}:{params:Promise<{locale:string}>}){
 const {locale:value}=await params,locale=callbackLocale(value);
 const user=await getAdminUser();const messages=managementMessages(locale,false),t=createTranslator(messages);
 if(!user?.isModerator)return <I18nMessages messages={messages}><main className="access-page"><h1>{t("management.businessModeration")}</h1><p>{user?t("management.noReviewAccess"):t("management.pleaseManagementLogin")}</p><Link href="/anmelden?weiter=/verwaltung/betriebe">{t("management.login")}</Link></main></I18nMessages>;
 return <I18nMessages messages={messages}><><SiteHeader account={{email:user.email,displayName:user.displayName,provider:user.provider}} isAdmin/><AdminNavigation active="business"/><main className="business-page wrap"><h1>{t("management.businessModeration")}</h1><p>{t("management.businessModerationHelp")}</p><BusinessPanel moderation/></main></></I18nMessages>;
}

export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;return managementMetadata(callbackLocale(locale),"claims");}
