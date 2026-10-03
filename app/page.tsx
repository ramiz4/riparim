import {redirect} from "next/navigation";
import Finder from "./finder";
import type {Workshop} from "@/lib/workshops";
import {listWorkshops} from "@/db/directory";
import {getAppUser,getAdminUser} from "./auth";
export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const query=await searchParams;if(typeof query.werkstatt==="string"){if(/^[a-z0-9][a-z0-9-]{2,80}$/.test(query.werkstatt))redirect(`/werkstatt/${encodeURIComponent(query.werkstatt)}`);redirect("/");}const user=await getAppUser(),admin=await getAdminUser(user);let directory:Workshop[]=[],error="";try{directory=await listWorkshops();}catch(e){console.error("directory-page",e);directory=[];error="Die Werkstattdaten sind gerade nicht verfügbar.";}return <Finder initialWorkshops={directory} initialError={error} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/>;}
