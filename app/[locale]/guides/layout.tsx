import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { DirectoryFooter } from "@/components/directory-footer";
import { I18nMessages } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/locale";

export default async function GuidesLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params,
    locale = isLocale(value) ? value : "de";
  // Guidance is always public. The header resolves account state through its
  // existing authorized API after hydration, never inside a public document.
  return (
    <I18nMessages messages={getMessages(locale, ["public"])}>
      <SiteHeader account={null} publicSnapshot />
      {children}
      <DirectoryFooter />
    </I18nMessages>
  );
}
