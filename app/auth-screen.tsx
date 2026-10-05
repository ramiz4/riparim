import {I18nMessages} from "@/lib/i18n/client";
import {getMessages,createTranslator} from "@/lib/i18n/messages";
import {isLocale,localizeHref} from "@/lib/i18n/locale";
import AuthForm,{type AuthScreen} from "./auth-form";
import {getAdminUser,getAppUser} from "./auth";
import {getAuthConfig,safeReturnPath,providerAvailability} from "@/lib/auth/config";
import {redirect} from "next/navigation";
export default async function AuthScreenPage({screen,searchParams,params}:{params:Promise<{locale:string}>;screen:AuthScreen;searchParams:Promise<{weiter?:string;fehler?:string;hinweis?:string}>}){const {locale:value}=await params,locale=isLocale(value)?value:"de",c=await getAuthConfig(),q=await searchParams,u=await getAppUser(),a=await getAdminUser(u),next=localizeHref(safeReturnPath(q.weiter),locale);if(screen==="login"&&c?.enabled&&u)redirect(next);const available=await providerAvailability(c),messages=getMessages(locale,["customer"]),t=createTranslator(messages);return <I18nMessages messages={messages}><AuthForm account={u?{email:u.email,displayName:u.displayName,provider:u.provider}:null} screen={screen} emailReady={screen==="register"?available.emailSignup:screen==="recovery"?available.emailRecovery:available.email} googleReady={available.google} isOwner={!!a?.isModerator} returnTo={next} notice={q.hinweis==="email-bestaetigt"?t("customer.emailConfirmed"):q.hinweis==="passwort-geaendert"?t("customer.passwordChanged"):undefined} errorHint={q.fehler==="bestaetigung"?t("customer.invalidLink"):q.fehler==="google"?t("customer.googleCancelled"):undefined}/></I18nMessages>;}
