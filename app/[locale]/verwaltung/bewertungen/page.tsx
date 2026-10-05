import {isLocale,localizeHref} from "@/lib/i18n/locale";
import {LocaleAnchor} from "@/components/locale-anchor";
import Link from "@/components/locale-link";
import {getAdminUser} from "@/app/auth";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import AdminReviews from "./reviews";

export const dynamic="force-dynamic";
export default async function AdminReviewsPage({params}:{params:Promise<{locale:string}>}){const {locale:value}=await params,locale=isLocale(value)?value:"de";
 const user=await getAdminUser();
 if(!user)return <main className="access-page"><h1>Bewertungen prüfen</h1><p>Melde dich mit deinem Verwaltungszugang an.</p><LocaleAnchor className="primary" href={chatGPTSignInPath(localizeHref("/verwaltung/bewertungen",locale))} target="_top">Mit ChatGPT anmelden</LocaleAnchor><Link href="/">Zur Werkstattsuche</Link></main>;
 if(!user.isModerator)return <main className="access-page"><h1>Kein Zugriff auf die Prüfung.</h1><p>Nur die zuständige Verwaltung kann Bewertungen und private Nachweise prüfen.</p><Link className="primary" href="/">Zur Werkstattsuche</Link></main>;
 return <AdminReviews account={{email:user.email,displayName:user.displayName,provider:user.provider}}/>;
}
