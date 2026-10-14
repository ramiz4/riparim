import { cn } from "@/lib/utils";
import { pageFrameClassName, contentTitleClassName } from "@/lib/presentation";
import { publicReleaseRender } from "@/lib/public-release";
import { deferredManagementPage } from "@/lib/deferred-page";
import { I18nMessages } from "@/lib/i18n/client";
import { createTranslator } from "@/lib/i18n/messages";
import { managementMessages, managementMetadata } from "@/lib/i18n/management";
import { callbackLocale } from "@/lib/auth/locale";
import Link from "@/components/locale-link";
import { getAdminUser } from "@/app/auth";
import { SiteHeader } from "@/components/site-header";
import { AdminNavigation } from "@/components/admin-navigation";
import { BusinessPanel } from "@/components/business-panel";

export const dynamic = "force-dynamic";
export default async function BusinessModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params,
    locale = callbackLocale(value);
  if (publicReleaseRender()) return deferredManagementPage("claims", locale);
  const user = await getAdminUser();
  const messages = managementMessages(locale, false),
    t = createTranslator(messages);
  if (!user?.isModerator)
    return (
      <I18nMessages messages={messages}>
        <main
          data-ui="access-page"
          className="mx-auto my-20 flex max-w-[600px] flex-col gap-[25px] p-[30px]"
        >
          <h1 className="text-[32px] leading-[1.2]">
            {t("management.businessModeration")}
          </h1>
          <p className="text-[#758273] dark:text-muted-foreground">
            {user
              ? t("management.noReviewAccess")
              : t("management.pleaseManagementLogin")}
          </p>
          <Link href="/anmelden?weiter=/verwaltung/betriebe">
            {t("management.login")}
          </Link>
        </main>
      </I18nMessages>
    );
  return (
    <I18nMessages messages={messages}>
      <>
        <SiteHeader
          account={{
            email: user.email,
            displayName: user.displayName,
            provider: user.provider,
          }}
          isAdmin
        />
        <AdminNavigation active="business" />
        <main
          className={cn(
            pageFrameClassName,
            "min-h-[calc(100svh_-_180px)] pt-[var(--content-page-padding-top)] pb-[var(--content-page-padding-bottom)]",
          )}
        >
          <h1 className={cn(contentTitleClassName, "focus:outline-none")}>
            {t("management.businessModeration")}
          </h1>
          <p className="mt-2 mb-[var(--content-page-gap)] text-[15px] leading-[1.6] text-muted-foreground">
            {t("management.businessModerationHelp")}
          </p>
          <BusinessPanel moderation />
        </main>
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
  return managementMetadata(callbackLocale(locale), "claims");
}
