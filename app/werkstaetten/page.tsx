import {listWorkshops} from "@/db/directory";
import {getAppUser,getAdminUser} from "@/app/auth";
import {parseCatalogueFilters} from "@/lib/catalogue-filters";
import type {Workshop} from "@/lib/workshops";
import Catalogue from "./catalogue";

export const dynamic="force-dynamic";
export default async function CataloguePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [query,user]=await Promise.all([searchParams,getAppUser()]);const admin=await getAdminUser(user);let directory:Workshop[]=[],error="";
 try{directory=await listWorkshops();}catch(e){console.error("catalogue-page",e);error="Werkstätten konnten nicht geladen werden.";}
 return <Catalogue initialWorkshops={directory} initialError={error} initialFilters={parseCatalogueFilters(query,directory)} signedIn={!!user} account={user?{email:user.email,displayName:user.displayName,provider:user.provider}:null} isAdmin={!!admin?.isModerator}/>;
}
