import {listWorkshops} from "@/db/directory";
import {googlePlacesConfiguration,resolveWorkshopGooglePlace} from "@/db/google-places";
import {json,sameOrigin} from "@/lib/http";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return json({error:"Ungültige Anfrage."},403);
 const {id}=await params;if(!/^[a-z0-9][a-z0-9-]{2,80}$/.test(id))return json({error:"Ungültige Werkstatt."},404);
 if(!googlePlacesConfiguration().enabled)return json({enabled:false,placeId:null});
 try{const workshop=(await listWorkshops()).find(w=>w.id===id);if(!workshop)return json({error:"Werkstatt nicht gefunden."},404);const placeId=await resolveWorkshopGooglePlace(workshop);return json({enabled:true,placeId});}
 catch{return json({error:"Google-Angaben sind gerade nicht verfügbar."},503);}
}
