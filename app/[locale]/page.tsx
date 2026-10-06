import {workshopDisplayById} from "@/lib/workshop-display.server";
import {I18nMessages} from "@/lib/i18n/client";
import {getMessages,createTranslator} from "@/lib/i18n/messages";
import {publicMetadata,isPrivateLandingMode,type PublicPageQuery} from "@/lib/i18n/public-metadata";
import {siteOrigin} from "@/lib/auth/config";
import {isLocale,localizeHref} from "@/lib/i18n/locale";
import {redirect} from "next/navigation";
import Finder from "@/app/finder";
import type {Workshop} from "@/lib/workshops";
import {listWorkshops} from "@/db/directory";
import {getAppUser,getAdminUser} from "@/app/auth";
export const dynamic="force-dynamic";
export async function generateMetadata({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<PublicPageQuery>}){const {locale:value}=await params,locale=isLocale(value)?value:"de",t=createTranslator(getMessages(locale,["metadata"]));return publicMetadata(locale,"/",siteOrigin(),{title:t("metadata.title"),description:t("metadata.description")},!isPrivateLandingMode(await searchParams));}
export default async function Home({searchParams,params}:{searchParams:Promise<Record<string,string|string[]|undefined>>;params:Promise<{locale:string}>}){const query=await searchParams,{locale:value}=await params,locale=isLocale(value)?value:"de";if(typeof query.werkstatt==="string"){if(/^[a-z0-9][a-z0-9-]{2,80}$/.test(query.werkstatt))redirect(localizeHref(`/werkstatt/${encodeURIComponent(query.werkstatt)}`,locale));redirect(localizeHref("/",locale));}const user=await getAppUser(),admin=await getAdminUser(user);let directory:Workshop[]=[],error="";try{directory=await listWorkshops();}catch(e){console.error("directory-page",e);directory=[];error="unavailable";}if(query.nachweis!==undefined){const workshop=typeof query.nachweis==="string"&&/^[a-z0-9][a-z0-9-]{2,80}$/.test(query.nachweis)?directory.find(w=>w.id===query.nachweis&&w.status==="published"):null;redirect(localizeHref(workshop?`/werkstatt/${encodeURIComponent(workshop.id)}#bewerten`:"/werkstaetten?bewerten=1",locale));}return <I18nMessages messages={getMessages(locale,["public","customer"])}><Finder initialDisplayById={await workshopDisplayById(directory,locale)} initialWorkshops={directory} initialError={error} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/></I18nMessages>;}
