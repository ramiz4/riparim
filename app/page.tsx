import Finder from "./finder";
import type {Workshop} from "@/lib/workshops";
import {listWorkshops} from "@/db/directory";
import {getAppUser,getAdminUser} from "./auth";
import {getAuthConfig} from "@/lib/auth/config";
import {moderatorEmail} from "@/db/storage";
export const dynamic="force-dynamic";
export default async function Home(){const user=await getAppUser(),admin=await getAdminUser(user),authConfig=await getAuthConfig();let directory:Workshop[]=[],error="";try{directory=await listWorkshops();}catch(e){console.error("directory-page",e);directory=[];error="Die Werkstattdaten sind gerade nicht verfügbar.";}return <Finder initialWorkshops={directory} initialError={error} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} emailAuthEnabled={!!authConfig?.enabled} isAdmin={!!admin?.isModerator}/>;}
