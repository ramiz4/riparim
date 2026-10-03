import Link from "next/link";
import {getAdminUser} from "@/app/auth";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import AdminReviews from "./reviews";

export const dynamic="force-dynamic";
export default async function AdminReviewsPage(){
 const user=await getAdminUser();
 if(!user)return <main className="access-page"><h1>Bewertungen prüfen</h1><p>Melde dich mit deinem Verwaltungszugang an.</p><a className="primary" href={chatGPTSignInPath("/verwaltung/bewertungen")} target="_top">Mit ChatGPT anmelden</a><Link href="/">Zur Werkstattsuche</Link></main>;
 if(!user.isModerator)return <main className="access-page"><h1>Kein Zugriff auf die Prüfung.</h1><p>Nur die zuständige Verwaltung kann Bewertungen und private Nachweise prüfen.</p><Link className="primary" href="/">Zur Werkstattsuche</Link></main>;
 return <AdminReviews account={{email:user.email,displayName:user.displayName,provider:user.provider}}/>;
}
