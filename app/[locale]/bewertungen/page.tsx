import type {Metadata} from "next";
import {getAppUser,getAdminUser} from "@/app/auth";
import {MyVisits} from "@/app/journeys";
import {listWorkshops} from "@/db/directory";
import {SiteHeader} from "@/components/site-header";
import {DirectoryFooter} from "@/components/directory-footer";
import {I18nMessages} from "@/lib/i18n/client";
import {getMessages,createTranslator} from "@/lib/i18n/messages";
import {callbackLocale} from "@/lib/auth/locale";
import {reviewSubmissionId} from "@/lib/own-reviews";
import type {Workshop} from "@/lib/workshops";
import "./reviews.css";

export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{const {locale}=await params,t=createTranslator(getMessages(callbackLocale(locale),["customer"]));return {title:`${t("customer.myReviews")} · Riparim`,robots:{index:false,follow:false},alternates:null};}

export default async function ReviewsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {locale:value}=await params,locale=callbackLocale(value),query=await searchParams;
 const user=await getAppUser(),admin=await getAdminUser(user);
 let directory:Workshop[]=[],directoryUnavailable=false;
 if(user)try{directory=await listWorkshops();}catch{console.error("own-reviews-directory-unavailable");directoryUnavailable=true;}
 const submissionId=reviewSubmissionId(query.einreichung);
 return <I18nMessages messages={getMessages(locale,["customer","public"])}><SiteHeader account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/><MyVisits key={`${user?.userId??"guest"}:${submissionId??"all"}`} directory={directory} directoryUnavailable={directoryUnavailable} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} submissionId={submissionId}/><DirectoryFooter/></I18nMessages>;
}
