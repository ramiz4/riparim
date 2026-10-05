import {isLocale,localizeHref} from "@/lib/i18n/locale";
import {LocaleAnchor} from "@/components/locale-anchor";
import Link from "@/components/locale-link";
import {getAdminUser} from "@/app/auth";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import AdminUsers from "./users";
import "./users.css";

export const dynamic="force-dynamic";

export default async function AdminUsersPage({params}:{params:Promise<{locale:string}>}){const {locale:value}=await params,locale=isLocale(value)?value:"de";
 const user=await getAdminUser();
 if(!user)return <main className="access-page"><h1>Benutzer verwalten</h1><p>Melde dich mit deinem Verwaltungszugang an.</p><LocaleAnchor className="primary" href={chatGPTSignInPath(localizeHref("/verwaltung/benutzer",locale))} target="_top">Mit ChatGPT anmelden</LocaleAnchor><Link href="/">Zur Werkstattsuche</Link></main>;
 if(!user.isModerator)return <main className="access-page"><h1>Kein Zugriff auf die Benutzerverwaltung.</h1><p>Nur die zuständige Verwaltung kann Benutzerkonten verwalten.</p><Link className="primary" href="/">Zur Werkstattsuche</Link></main>;
 return <AdminUsers account={{email:user.email,displayName:user.displayName,provider:user.provider}}/>;
}
