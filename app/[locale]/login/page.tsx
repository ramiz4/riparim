import { getMessages, createTranslator } from "@/lib/i18n/messages";
import { callbackLocale } from "@/lib/auth/locale";
import type { Metadata } from "next";
import AuthScreenPage from "@/app/auth-screen";
import {
  parseAuthScreenQuery,
  type AuthScreenSearchParams,
} from "@/lib/auth/screen-query";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
  params,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<AuthScreenSearchParams>;
}) {
  return (
    <AuthScreenPage
      screen="login"
      query={parseAuthScreenQuery(await searchParams)}
      params={params}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = createTranslator(getMessages(callbackLocale(locale), ["customer"]));
  return {
    title: `${t("customer.authLogin")} · Riparim`,
    robots: { index: false, follow: false },
    alternates: null,
  };
}
