import { notFound } from "next/navigation";
import { authRequestState } from "@/lib/auth/request-context";
import { publicReleaseRender, publicReleaseShell } from "@/lib/public-release";
import { workshopDisplayById } from "@/lib/workshop-display.server";
import { I18nMessages } from "@/lib/i18n/client";
import { getMessages, createTranslator } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/locale";
import { publicMetadata } from "@/lib/i18n/public-metadata";
import { siteOrigin } from "@/lib/auth/config";
import { listWorkshops } from "@/db/directory";
import { cityWorkshops, workshopCity } from "@/lib/workshop-cities";
import type { Workshop } from "@/lib/workshops";
import CityDirectory from "./city-directory";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ locale: string; city: string }> };
export async function generateMetadata({ params }: Params) {
  const { locale: value, city: slug } = await params;
  const city = workshopCity(slug);
  if (!city || !isLocale(value)) notFound();
  const t = createTranslator(getMessages(value, ["city"]));
  return publicMetadata(value, `/workshops/${city.slug}`, siteOrigin(), {
    title: t("city.title", { city: city.name }),
    description: t("city.description", { city: city.name }),
  });
}
export default async function CityPage({ params }: Params) {
  const { locale, city: slug } = await params;
  const city = workshopCity(slug);
  if (!city || !isLocale(locale)) notFound();
  const liveShell = !publicReleaseRender() && authRequestState().rsc === true;
  let directory: Workshop[] = [],
    error = false;
  try {
    if (!publicReleaseShell() && !liveShell)
      directory = cityWorkshops(await listWorkshops(), city);
  } catch (cause) {
    console.error(
      "city-directory-read",
      cause instanceof Error ? cause.name : "unknown",
    );
    error = true;
  }
  return (
    <I18nMessages messages={getMessages(locale, ["public", "city"])}>
      <CityDirectory
        key={`${locale}-${city.slug}`}
        city={city}
        initialWorkshops={directory}
        initialDisplayById={await workshopDisplayById(directory, locale)}
        initialError={error}
        publicSnapshot={publicReleaseRender() || liveShell}
      />
    </I18nMessages>
  );
}
