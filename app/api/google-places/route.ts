import {googlePlacesConfiguration} from "@/db/google-places";
import {json,sameOrigin} from "@/lib/http";
export const dynamic="force-dynamic";
export async function GET(request:Request){if(!sameOrigin(request))return json({error:"Ungültige Anfrage."},403);const config=googlePlacesConfiguration();return json(config.enabled?{enabled:true,browserKey:config.browserKey}:{enabled:false});}
