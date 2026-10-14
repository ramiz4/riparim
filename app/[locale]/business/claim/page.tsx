import { cn } from "@/lib/utils";
import {
  pageFrameClassName,
  contentTitleClassName,
  errorClassName,
  appButton,
} from "@/lib/presentation";
import { publicReleaseRender } from "@/lib/public-release";
import { deferredManagementPage } from "@/lib/deferred-page";
import { I18nMessages } from "@/lib/i18n/client";
import { createTranslator } from "@/lib/i18n/messages";
import { managementMessages, managementMetadata } from "@/lib/i18n/management";
import { callbackLocale } from "@/lib/auth/locale";
import { localizeHref } from "@/lib/i18n/locale";
import Link from "@/components/locale-link";
import { getAppUser, getAdminUser } from "@/app/auth";
import { listWorkshops } from "@/db/directory";
import { SiteHeader } from "@/components/site-header";
import { DirectoryFooter } from "@/components/directory-footer";
import { BusinessClaimForm } from "@/components/business-claim-form";

export const dynamic = "force-dynamic";
export default async function BusinessClaimPage({
  searchParams,
  params,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ werkstatt?: string | string[] }>;
}) {
  const { locale: value } = await params,
    locale = callbackLocale(value),
    query = await searchParams;
  const workshopId =
    typeof query.werkstatt === "string" ? query.werkstatt : undefined;
  if (publicReleaseRender()) return deferredManagementPage("claim", locale);
  const user = await getAppUser(),
    admin = await getAdminUser(user);
  let workshop: Awaited<ReturnType<typeof listWorkshops>>[number] | null = null,
    directoryUnavailable = false;
  if (user && workshopId)
    try {
      workshop =
        (await listWorkshops()).find(
          (workshop) => workshop.id === workshopId,
        ) ?? null;
    } catch {
      directoryUnavailable = true;
      console.error("business-claim-directory-unavailable");
    }
  const messages = managementMessages(locale, true),
    t = createTranslator(messages),
    returnTo = localizeHref(
      `/betriebe/beanspruchen${workshopId ? `?werkstatt=${encodeURIComponent(workshopId)}` : ""}`,
      locale,
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
          "min-h-[calc(100svh_-_180px)] max-w-[680px] pt-4 pb-9 at-most-720:pt-2.5",
        )}
      >
        {user ? (
          directoryUnavailable ? (
            <>
              <h1 className={cn(contentTitleClassName, "focus:outline-none")}>
                {t("management.claimTitle")}
              </h1>
              <p
                className={cn(
                  errorClassName,
                  "mt-2 mb-[var(--content-page-gap)] leading-[1.6]",
                )}
                role="alert"
              >
                {t("management.businessUnavailable")}
              </p>
              <Link
                className={cn(
                  appButton({ variant: "outline" }),
                  "px-[13px] py-2",
                )}
                href={returnTo}
              >
                {t("management.retryBusiness")}
              </Link>
            </>
          ) : (
            <BusinessClaimForm
              key={`${user.userId}:${workshop?.id ?? "missing"}`}
              workshop={workshop}
            />
          )
        ) : (
          <>
            <h1 className={cn(contentTitleClassName, "focus:outline-none")}>
              {t("management.claimTitle")}
            </h1>
            <p className="mt-2 mb-[var(--content-page-gap)] text-[15px] leading-[1.6] text-muted-foreground">
              <Link
                className={appButton()}
                href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}
              >
                {t("management.login")}
              </Link>{" "}
              {t("management.businessLogin")}
            </p>
          </>
        )}
      </main>
      <DirectoryFooter />
    </I18nMessages>
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return managementMetadata(callbackLocale(locale), "claim");
}
