import {getAdminUser} from "@/app/auth";
import {chatGPTSignInPath} from "@/app/chatgpt-auth";
import AuthSetup from "./setup";
export const dynamic="force-dynamic";
export default async function Page(){const u=await getAdminUser();if(!u?.isModerator)return <main className="access-page"><h1>Eigentümerzugang erforderlich.</h1><p>Nur die zuständige Verwaltung kann den Anmeldedienst verbinden.</p><a className="primary" href={chatGPTSignInPath("/verwaltung/anmeldung")} target="_top">Eigentümerzugang mit ChatGPT</a><a href="/">Zur Suche</a></main>;return <AuthSetup/>;}
