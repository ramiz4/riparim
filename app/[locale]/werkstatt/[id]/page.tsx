import {callbackLocale} from "@/lib/auth/locale";
import {I18nMessages} from "@/lib/i18n/client";
import {getMessages} from "@/lib/i18n/messages";
import {notFound} from "next/navigation";
import {listWorkshops} from "@/db/directory";
import {storage} from "@/db/storage";
import {getAppUser,getAdminUser} from "@/app/auth";
import type {Review} from "@/app/journeys";
import WorkshopProfile from "./profile";

export const dynamic="force-dynamic";
export default async function WorkshopPage({params}:{params:Promise<{id:string;locale:string}>}){
 const {id,locale:value}=await params,locale=callbackLocale(value);if(!/^[a-z0-9][a-z0-9-]{2,80}$/.test(id))notFound();
 const [directory,user]=await Promise.all([listWorkshops(),getAppUser()]);
 const workshop=directory.find(w=>w.id===id);if(!workshop)notFound();
 const admin=await getAdminUser(user);
 let reviews:Review[]=[],reviewError="";
 try{const result=await storage().db.prepare("SELECT v.display_name,v.vehicle,v.service,v.date,v.rating,v.review FROM visits v JOIN workshops w ON w.id=v.workshop AND w.status='published' WHERE v.workshop=? AND v.status='published' ORDER BY v.created_at DESC LIMIT 100").bind(id).all<Review>();reviews=result.results;}
 catch(e){console.error("profile-reviews",e);reviewError="Bewertungen sind gerade nicht verfügbar.";}
 return <I18nMessages messages={getMessages(locale,["customer"])}><WorkshopProfile workshop={workshop} directory={directory} reviews={reviews} reviewError={reviewError} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/></I18nMessages>;
}
