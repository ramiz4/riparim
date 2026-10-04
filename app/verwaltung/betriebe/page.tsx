import Link from "next/link";
import {getAdminUser} from "@/app/auth";
import {SiteHeader} from "@/components/site-header";
import {AdminNavigation} from "@/components/admin-navigation";
import {BusinessPanel} from "@/components/business-panel";
import "@/app/betrieb/business.css";

export const dynamic="force-dynamic";
export default async function BusinessModerationPage(){
 const user=await getAdminUser();
 if(!user?.isModerator)return <main className="access-page"><h1>Betriebsanträge prüfen</h1><p>{user?"Kein Zugriff auf die Prüfung.":"Bitte melde dich mit deinem Verwaltungszugang an."}</p><Link href="/anmelden?weiter=/verwaltung/betriebe">Anmelden</Link></main>;
 return <><SiteHeader account={{email:user.email,displayName:user.displayName,provider:user.provider}} isAdmin/><AdminNavigation active="business"/><main className="business-page wrap"><h1>Betriebsanträge prüfen</h1><p>Private Inhabernachweise prüfen und Profilentwürfe freigeben. Öffentliche Angaben ändern sich erst nach Bestätigung.</p><BusinessPanel moderation/></main></>;
}
