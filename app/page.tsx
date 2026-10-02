import Finder from "./finder";
import type {Workshop} from "@/lib/workshops";
import {listWorkshops} from "@/db/directory";
import {getChatGPTUser} from "./chatgpt-auth";
import {moderatorEmail} from "@/db/storage";
export const dynamic="force-dynamic";
export default async function Home(){const user=await getChatGPTUser();let directory:Workshop[]=[],error="";try{directory=await listWorkshops();}catch(e){console.error("directory-page",e);directory=[];error="Die Werkstattdaten sind gerade nicht verfügbar.";}return <Finder initialWorkshops={directory} initialError={error} signedIn={!!user} isAdmin={!!user&&user.email.toLowerCase()===moderatorEmail()}/>;}
