import {workshopDisplayById} from "@/lib/workshop-display.server";
import {I18nMessages} from "@/lib/i18n/client";
import {getMessages,createTranslator} from "@/lib/i18n/messages";
import {isLocale} from "@/lib/i18n/locale";
import {profileSearchHref} from "@/lib/profile-navigation";
import {publicMetadata} from "@/lib/i18n/public-metadata";
import {siteOrigin} from "@/lib/auth/config";
import {notFound} from "next/navigation";
import {listWorkshops} from "@/db/directory";
import {storage} from "@/db/storage";
import {getAppUser,getAdminUser} from "@/app/auth";
import type {Review} from "@/app/journeys";
import WorkshopProfile from "./profile";

export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{id:string;locale:string}>}){
 const {id,locale:value}=await params,locale=isLocale(value)?value:"de",t=createTranslator(getMessages(locale,["public"]));
 const unavailable={title:t("public.notFoundTitle"),robots:{index:false,follow:false},alternates:null};
 // Page-level notFound keeps HTTP404; streamed metadata signals can become HTTP200.
 if(!/^[a-z0-9][a-z0-9-]{2,80}$/.test(id))return unavailable;
 let directory;try{directory=await listWorkshops();}catch{return unavailable;}
 const workshop=directory.find(w=>w.id===id);if(!workshop)return unavailable;
 return publicMetadata(locale,`/werkstatt/${id}`,siteOrigin(),{title:t("public.profileTitle",{name:workshop.name,city:workshop.city}),description:t("public.profileDescription",{name:workshop.name,city:workshop.city})});
}
export default async function WorkshopPage({params,searchParams=Promise.resolve({})}:{params:Promise<{id:string;locale:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const {id,locale:value}=await params,locale=isLocale(value)?value:"de";if(!/^[a-z0-9][a-z0-9-]{2,80}$/.test(id))notFound();
 const [directory,user]=await Promise.all([listWorkshops(),getAppUser()]);
 const workshop=directory.find(w=>w.id===id);if(!workshop)notFound();
 const displayById=await workshopDisplayById([workshop],locale);
 const query=await searchParams,initialSearchHref=profileSearchHref(typeof query.suche==="string"?query.suche:null,directory);
 const admin=await getAdminUser(user);
 let reviews:Review[]=[],reviewError="";
 try{const result=await storage().db.prepare("SELECT v.display_name,v.vehicle,v.service,v.date,v.rating,v.review FROM visits v JOIN workshops w ON w.id=v.workshop AND w.status='published' WHERE v.workshop=? AND v.status='published' ORDER BY v.created_at DESC LIMIT 100").bind(id).all<Review>();reviews=result.results;}
 catch(e){console.error("profile-reviews",e);reviewError="unavailable";}
 return <I18nMessages messages={getMessages(locale,["public","customer"])}><WorkshopProfile display={displayById[workshop.id]} initialSearchHref={initialSearchHref} workshop={workshop} directory={directory} reviews={reviews} reviewError={reviewError} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/></I18nMessages>;
}
