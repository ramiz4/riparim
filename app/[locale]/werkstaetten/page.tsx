import {I18nMessages} from "@/lib/i18n/client";
import {getMessages,createTranslator} from "@/lib/i18n/messages";
import {isLocale} from "@/lib/i18n/locale";
import {publicMetadata} from "@/lib/i18n/public-metadata";
import {siteOrigin} from "@/lib/auth/config";
import {listWorkshops} from "@/db/directory";
import {getAppUser,getAdminUser} from "@/app/auth";
import {parseCatalogueFilters} from "@/lib/catalogue-filters";
import type {Workshop} from "@/lib/workshops";
import Catalogue from "./catalogue";

export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale:value}=await params,locale=isLocale(value)?value:"de",t=createTranslator(getMessages(locale,["public"]));return publicMetadata(locale,"/werkstaetten",siteOrigin(),{title:t("public.catalogueTitle"),description:t("public.catalogueDescription")});}
export default async function CataloguePage({searchParams,params}:{searchParams:Promise<Record<string,string|string[]|undefined>>;params:Promise<{locale:string}>}){
 const {locale:value}=await params,locale=isLocale(value)?value:"de";
 const [query,user]=await Promise.all([searchParams,getAppUser()]);const admin=await getAdminUser(user);let directory:Workshop[]=[],error="";
 try{directory=await listWorkshops();}catch(e){console.error("catalogue-page",e);error="unavailable";}
 return <I18nMessages messages={getMessages(locale,["public","customer"])}><Catalogue initialWorkshops={directory} initialError={error} initialFilters={parseCatalogueFilters(query,directory)} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/></I18nMessages>;
}
