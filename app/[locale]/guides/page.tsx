import { GuideIndexContent } from "@/components/workshop-guide-content";
import { guideMessages } from "@/lib/i18n/guide-messages";
import { isLocale } from "@/lib/i18n/locale";
import { publicMetadata } from "@/lib/i18n/public-metadata";
import { siteOrigin } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params,
    locale = isLocale(value) ? value : "de",
    text = guideMessages[locale];
  return publicMetadata(locale, "/guides", siteOrigin(), {
    title: `${text.indexTitle} · Riparim`,
    description: text.indexDescription,
  });
}
export default async function GuidesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  return <GuideIndexContent locale={isLocale(value) ? value : "de"} />;
}
