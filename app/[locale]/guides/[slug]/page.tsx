import { notFound } from "next/navigation";
import { GuideArticleContent } from "@/components/workshop-guide-content";
import { guideMessages, isGuideId } from "@/lib/i18n/guide-messages";
import { isLocale } from "@/lib/i18n/locale";
import { publicMetadata } from "@/lib/i18n/public-metadata";
import { siteOrigin } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: PageProps) {
  const { locale: value, slug } = await params,
    locale = isLocale(value) ? value : "de";
  if (!isGuideId(slug)) notFound();
  const article = guideMessages[locale].articles[slug];
  return publicMetadata(locale, `/guides/${slug}`, siteOrigin(), {
    title: `${article.title} · Riparim`,
    description: article.description,
  });
}
export default async function GuidePage({ params }: PageProps) {
  const { locale: value, slug } = await params;
  if (!isGuideId(slug)) notFound();
  return (
    <GuideArticleContent locale={isLocale(value) ? value : "de"} id={slug} />
  );
}
