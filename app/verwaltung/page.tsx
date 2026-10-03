import Link from "next/link";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import {getAdminUser} from "@/app/auth";
import AdminPanel from "./panel";
export const dynamic="force-dynamic";
export default async function AdminPage(){const user=await getAdminUser();if(!user)return <main className="access-page"><h1>Werkstattverwaltung</h1><p>Melde dich an, um Werkstätten und Besuchsnachweise zu verwalten.</p><a className="primary" href={chatGPTSignInPath("/verwaltung")} target="_top">Mit ChatGPT anmelden</a><Link href="/">Zur Suche</Link></main>;if(!user.isModerator)return <main className="access-page"><h1>Kein Zugriff auf die Verwaltung.</h1><p>Du kannst Werkstätten suchen und deine eigenen Besuche nachweisen.</p><Link className="primary" href="/">Zur Werkstattsuche</Link></main>;return <AdminPanel account={{email:user.email,displayName:user.displayName,provider:user.provider}}/>;}
