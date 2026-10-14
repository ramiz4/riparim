import { cn } from "@/lib/utils";
import {
  pageFrameClassName,
  contentTitleClassName,
  appButton,
} from "@/lib/presentation";
import { publicReleaseRender } from "@/lib/public-release";
import { deferredManagementPage } from "@/lib/deferred-page";
import { I18nMessages } from "@/lib/i18n/client";
import { createTranslator } from "@/lib/i18n/messages";
import { managementMessages, managementMetadata } from "@/lib/i18n/management";
import { callbackLocale } from "@/lib/auth/locale";

import Link from "@/components/locale-link";
import { getAppUser, getAdminUser } from "@/app/auth";
import { localizeHref } from "@/lib/i18n/locale";
import { SiteHeader } from "@/components/site-header";
import { DirectoryFooter } from "@/components/directory-footer";
import { BusinessPanel } from "@/components/business-panel";

export const dynamic = "force-dynamic";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params,
    locale = callbackLocale(value);
  if (publicReleaseRender()) return deferredManagementPage("business", locale);
  const user = await getAppUser(),
    admin = await getAdminUser(user),
    messages = managementMessages(locale, true),
    t = createTranslator(messages);
  return (
    <I18nMessages messages={messages}>
      <>
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
          {!user && (
            <>
              <h1 className={cn(contentTitleClassName, "focus:outline-none")}>
                {t("management.myBusiness")}
              </h1>
              <p className="mt-2 mb-[var(--content-page-gap)] text-[15px] leading-[1.6] text-muted-foreground">
                {t("management.businessIntro")}
              </p>
            </>
          )}
          {user ? (
            <BusinessPanel key="businesses" />
          ) : (
            <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
              <Link
                className={appButton()}
                href={`/anmelden?weiter=${encodeURIComponent(localizeHref("/betriebe", locale))}`}
              >
                {t("management.login")}
              </Link>{" "}
              {t("management.businessLogin")}
            </p>
          )}
        </main>
        <DirectoryFooter />
      </>
    </I18nMessages>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return managementMetadata(callbackLocale(locale), "business");
}
