import type {Metadata} from "next";
import Link from "next/link";
import {getAppUser,getAdminUser} from "@/app/auth";
import {listWorkshops} from "@/db/directory";
import {SiteHeader} from "@/components/site-header";
import {DirectoryFooter} from "@/components/directory-footer";
import {BusinessPanel} from "@/components/business-panel";
import "./business.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Mein Betrieb · Riparim"};
export default async function BusinessPage({searchParams}:{searchParams:Promise<{werkstatt?:string}>}){
 const user=await getAppUser(),admin=await getAdminUser(user),params=await searchParams;
 const directory=user?await listWorkshops():[];
 return <><SiteHeader account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/><main className="business-page wrap"><h1>Mein Betrieb</h1><p>Beanspruche dein Werkstattprofil und reiche bestätigte Angaben zur Freigabe ein.</p>{user?<BusinessPanel directory={directory} initialWorkshop={params.werkstatt}/>:<p><Link className="primary" href={`/anmelden?weiter=${encodeURIComponent(`/betrieb${params.werkstatt?`?werkstatt=${encodeURIComponent(params.werkstatt)}`:""}`)}`}>Anmelden</Link> Melde dich an, um einen Inhabernachweis einzureichen.</p>}</main><DirectoryFooter/></>;
}
