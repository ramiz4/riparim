import { authRequestState } from "@/lib/auth/request-context";
import { publicReleaseRender, publicReleaseShell } from "@/lib/public-release";
import { workshopDisplayById } from "@/lib/workshop-display.server";
import { I18nMessages } from "@/lib/i18n/client";
import { getMessages, createTranslator } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/locale";
import { publicMetadata } from "@/lib/i18n/public-metadata";
import { siteOrigin } from "@/lib/auth/config";
import { listWorkshops } from "@/db/directory";
import { getAppUser, getAdminUser } from "@/app/auth";
import { parseCatalogueFilters } from "@/lib/catalogue-filters";
import type { Workshop } from "@/lib/workshops";
import Catalogue from "./catalogue";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params,
    locale = isLocale(value) ? value : "de",
    t = createTranslator(getMessages(locale, ["public"]));
  return publicMetadata(locale, "/werkstaetten", siteOrigin(), {
    title: t("public.catalogueTitle"),
    description: t("public.catalogueDescription"),
  });
}
export default async function CataloguePage({
  searchParams,
  params,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params,
    locale = isLocale(value) ? value : "de";
  const liveShell = !publicReleaseRender() && authRequestState().rsc === true;
  const [query, user] = await Promise.all([
    searchParams,
    liveShell ? null : getAppUser(),
  ]);
  const admin = liveShell ? null : await getAdminUser(user);
  let directory: Workshop[] = [],
    error = "";
  try {
    if (!publicReleaseShell() && !liveShell) directory = await listWorkshops();
  } catch (e) {
    console.error("catalogue-page", e);
    error = "unavailable";
  }
  return (
    <I18nMessages messages={getMessages(locale, ["public"])}>
      <Catalogue
        publicSnapshot={publicReleaseRender() || liveShell}
        initialDisplayById={await workshopDisplayById(directory, locale)}
        initialWorkshops={directory}
        initialError={error}
        reviewEntry={query.bewerten === "1"}
        initialFilters={parseCatalogueFilters(query, directory)}
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
    </I18nMessages>
  );
}
