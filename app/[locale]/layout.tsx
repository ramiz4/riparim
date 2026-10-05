import type { Metadata } from "next";
import {notFound} from "next/navigation";
import {isLocale} from "@/lib/i18n/locale";
import {ThemeProvider} from "@/components/theme-provider";
import "../globals.css";
import "../ui-refresh.css";
import "../site-header.css";
import "../auth.css";
import "../catalogue.css";
import "../workshop-pages.css";
import "../ratings.css";
import "../form-controls.css";
import "../theme.css";
import "../footer.css";
import {getMessages,createTranslator} from "@/lib/i18n/messages";
import {I18nProvider} from "@/lib/i18n/client";
import {LocaleNotice} from "@/components/locale-notice";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{const {locale}=await params;if(!isLocale(locale))notFound();const t=createTranslator(getMessages(locale,["metadata"]));return {title:t("metadata.title"),description:t("metadata.description"),icons:{icon:"/riparim-icon-display.png",shortcut:"/riparim-icon-display.png"}};}
export default async function RootLayout({children,params}:Readonly<{children:React.ReactNode;params:Promise<{locale:string}>}>){const {locale}=await params;if(!isLocale(locale))notFound();return <html lang={locale} suppressHydrationWarning><body><I18nProvider locale={locale} messages={getMessages(locale,["common"])}><ThemeProvider><LocaleNotice/>{children}</ThemeProvider></I18nProvider></body></html>;}
