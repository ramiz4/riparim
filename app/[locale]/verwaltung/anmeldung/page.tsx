import {isLocale,localizeHref} from "@/lib/i18n/locale";
import {LocaleAnchor} from "@/components/locale-anchor";
import Link from "@/components/locale-link";
import {getAdminUser} from "@/app/auth";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import AuthSetup from "./setup";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale:value}=await params,locale=isLocale(value)?value:"de";const u=await getAdminUser();if(!u?.isModerator)return <main className="access-page"><h1>Eigentümerzugang erforderlich.</h1><p>Nur die zuständige Verwaltung kann den Anmeldedienst verbinden.</p><LocaleAnchor className="primary" href={chatGPTSignInPath(localizeHref("/verwaltung/anmeldung",locale))} target="_top">Eigentümerzugang mit ChatGPT</LocaleAnchor><Link href="/">Zur Suche</Link></main>;return <AuthSetup account={{email:u.email,displayName:u.displayName,provider:u.provider}}/>;}
