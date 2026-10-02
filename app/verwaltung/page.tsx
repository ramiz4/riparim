import {getChatGPTUser,chatGPTSignInPath} from "@/app/chatgpt-auth";
import {moderatorEmail} from "@/db/storage";
import AdminPanel from "./panel";
export const dynamic="force-dynamic";
export default async function AdminPage(){const user=await getChatGPTUser();if(!user)return <main className="access-page"><h1>Werkstattverwaltung</h1><p>Melde dich an, um Werkstätten und Besuchsnachweise zu verwalten.</p><a className="primary" href={chatGPTSignInPath("/verwaltung")} target="_top">Mit ChatGPT anmelden</a><a href="/">Zur Suche</a></main>;if(user.email.toLowerCase()!==moderatorEmail())return <main className="access-page"><h1>Kein Zugriff auf die Verwaltung.</h1><p>Du kannst Werkstätten suchen und deine eigenen Besuche nachweisen.</p><a className="primary" href="/">Zur Werkstattsuche</a></main>;return <AdminPanel/>;}
