import { cn } from "@/lib/utils";
import { pageFrameClassName, contentTitleClassName } from "@/lib/presentation";
import { localSeedPreviewAccount } from "@/lib/auth/local-development";
import { publicReleaseRender } from "@/lib/public-release";
import { deferredManagementPage } from "@/lib/deferred-page";
import { I18nMessages } from "@/lib/i18n/client";
import { getMessages, createTranslator } from "@/lib/i18n/messages";
import { callbackLocale } from "@/lib/auth/locale";
import type { Metadata } from "next";
import { getAdminUser, getAppUser } from "@/app/auth";
import { DirectoryFooter } from "@/components/directory-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeSettings } from "@/components/theme-settings";
import { AccountSettings } from "@/components/account-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = createTranslator(getMessages(callbackLocale(locale), ["customer"]));
  return {
    title: `${t("customer.settings")} · Riparim`,
    robots: { index: false, follow: false },
    alternates: null,
  };
}
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ vorschau?: string | string[] }>;
}) {
  const { locale: value } = await params,
    locale = callbackLocale(value),
    messages = getMessages(locale, ["customer", "public"]),
    t = createTranslator(messages);
  if (publicReleaseRender()) return deferredManagementPage("settings", locale);
  const user = await getAppUser();
  const admin = await getAdminUser(user);
  const localPreviewAccount = await localSeedPreviewAccount(
    user,
    (await searchParams)?.vorschau,
  );

  return (
    <I18nMessages messages={messages}>
      <SiteHeader
        account={
          user
            ? {
                email: user.email,
                displayName: user.displayName,
                provider: user.provider,
              }
            : null
        }
        isAdmin={!!admin?.isModerator}
      />
      <main
        className={cn(
          pageFrameClassName,
          "min-h-[calc(100svh_-_180px)] pt-[var(--content-page-padding-top)] pb-[var(--content-page-padding-bottom)]",
        )}
      >
        <h1
          className={cn(contentTitleClassName, "mb-[var(--content-page-gap)]")}
        >
          {t("customer.settings")}
        </h1>
        <AccountSettings
          key={localPreviewAccount?.kind ?? "account"}
          localPreviewAccount={localPreviewAccount}
          appearance={<ThemeSettings />}
        />
      </main>
      <DirectoryFooter />
    </I18nMessages>
  );
}
