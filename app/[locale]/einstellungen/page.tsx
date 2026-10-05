import {I18nMessages} from "@/lib/i18n/client";
import {getMessages,createTranslator} from "@/lib/i18n/messages";
import {callbackLocale} from "@/lib/auth/locale";
import type { Metadata } from "next";
import { getAdminUser, getAppUser } from "@/app/auth";
import { DirectoryFooter } from "@/components/directory-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeSettings } from "@/components/theme-settings";
import { AccountSettings } from "@/components/account-settings";
import "./settings.css";

export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{const {locale}=await params;const t=createTranslator(getMessages(callbackLocale(locale),["customer"]));return {title:`${t("customer.settings")} · Riparim`,robots:{index:false,follow:false},alternates:null};}
export const dynamic = "force-dynamic";

export default async function SettingsPage({params}:{params:Promise<{locale:string}>}) {
 const {locale:value}=await params,locale=callbackLocale(value),messages=getMessages(locale,["customer","public"]),t=createTranslator(messages);
  const user = await getAppUser();
  const admin = await getAdminUser(user);

  return (
    <I18nMessages messages={messages}>
      <SiteHeader account={user ? { email: user.email, displayName: user.displayName, provider: user.provider } : null} isAdmin={!!admin?.isModerator} />
      <main className="settings-page wrap">
        <h1>{t("customer.settings")}</h1>
        <ThemeSettings />
        <AccountSettings />
      </main>
      <DirectoryFooter />
    </I18nMessages>
  );
}
