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
import "./business.css";

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
        <main className="business-page wrap">
          {!user && (
            <>
              <h1>{t("management.myBusiness")}</h1>
              <p>{t("management.businessIntro")}</p>
            </>
          )}
          {user ? (
            <BusinessPanel key="businesses" />
          ) : (
            <p>
              <Link
                className="primary"
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
