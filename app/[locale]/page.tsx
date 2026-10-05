import type {Metadata} from "next";
import {isPrivateLandingMode} from "@/lib/i18n/public-metadata";
import {I18nMessages} from "@/lib/i18n/client";
import {getMessages} from "@/lib/i18n/messages";
import {isLocale,localizeHref} from "@/lib/i18n/locale";
import {redirect} from "next/navigation";
import Finder from "@/app/finder";
import type {Workshop} from "@/lib/workshops";
import {listWorkshops} from "@/db/directory";
import {getAppUser,getAdminUser} from "@/app/auth";
export const dynamic="force-dynamic";
export default async function Home({searchParams,params}:{searchParams:Promise<Record<string,string|string[]|undefined>>;params:Promise<{locale:string}>}){const query=await searchParams,{locale:value}=await params,locale=isLocale(value)?value:"de";if(typeof query.werkstatt==="string"){if(/^[a-z0-9][a-z0-9-]{2,80}$/.test(query.werkstatt))redirect(localizeHref(`/werkstatt/${encodeURIComponent(query.werkstatt)}`,locale));redirect(localizeHref("/",locale));}const user=await getAppUser(),admin=await getAdminUser(user);let directory:Workshop[]=[],error="";try{directory=await listWorkshops();}catch(e){console.error("directory-page",e);directory=[];error="Die Werkstattdaten sind gerade nicht verfügbar.";}return <I18nMessages messages={getMessages(locale,["customer"])}><Finder initialWorkshops={directory} initialError={error} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/></I18nMessages>;}

export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}):Promise<Metadata>{return isPrivateLandingMode(await searchParams)?{robots:{index:false,follow:false},alternates:null}:{};}
