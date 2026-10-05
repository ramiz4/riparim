import {getMessages,createTranslator} from "@/lib/i18n/messages";
import {callbackLocale} from "@/lib/auth/locale";
import type {Metadata} from "next";
import AuthScreenPage from "@/app/auth-screen";
export const dynamic="force-dynamic";
export default function Page({searchParams,params}:{params:Promise<{locale:string}>;searchParams:Promise<{weiter?:string;fehler?:string}>}){return <AuthScreenPage screen="reset" searchParams={searchParams} params={params}/>;}

export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{const {locale}=await params;const t=createTranslator(getMessages(callbackLocale(locale),["customer"]));return {title:`${t("customer.authReset")} · Riparim`,robots:{index:false,follow:false},alternates:null};}
