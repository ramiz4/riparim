import {z} from "zod";
import {getAppUser,getAdminUser} from "@/app/auth";
import {json,readJson,sameOrigin} from "@/lib/http";
import {businessProfileSchema,claimSchema} from "@/lib/business-contract";
import {BusinessError,businessState,requestWorkshopClaim,requestWorkshopChange,decideClaim,decideChange} from "@/lib/business";

export const dynamic="force-dynamic";
const id=z.string().uuid();
const createSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("claim"),input:claimSchema}).strict(),
 z.object({kind:z.literal("change"),workshopId:z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/),profile:businessProfileSchema}).strict()
]);
const decisionSchema=z.object({kind:z.enum(["claim","change"]),id,revision:z.number().int().nonnegative(),decision:z.enum(["approved","rejected"]),note:z.string().trim().min(10).max(2000)}).strict();
async function input(request:Request,maxBytes:number){try{return await readJson(request,maxBytes);}catch{throw new BusinessError("Ungültige Eingaben.",400);}}
function failure(error:unknown){
 if(error instanceof BusinessError)return json({error:error.message},error.status);
 if(error instanceof z.ZodError)return json({error:"Bitte prüfe deine Eingaben, den Nachweis und die Beleglinks."},400);
 console.error("business-operation-failed",error instanceof Error?error.name:"unknown");
 return json({error:"Der Betriebsbereich ist gerade nicht verfügbar. Deine Eingaben bleiben erhalten."},503);
}
export async function GET(request:Request){
 try{
  const moderation=new URL(request.url).searchParams.get("moderation")==="1",user=moderation?await getAdminUser():await getAppUser();
  if(!user)return json({error:"Bitte melde dich an."},401);
  if(moderation&&!user.isModerator)return json({error:"Kein Zugriff auf die Prüfung."},403);
  return json(await businessState(user,moderation));
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request)||!request.headers.get("content-type")?.includes("application/json"))return json({error:"Ungültige Anfrage."},403);
 try{
  const user=await getAppUser();if(!user)return json({error:"Bitte melde dich an."},401);
  const body=createSchema.parse(await input(request,16000));
  const created=body.kind==="claim"?await requestWorkshopClaim(user,body.input):await requestWorkshopChange(user,body.workshopId,body.profile);
  return json({id:created,status:"pending"},201);
 }catch(e){return failure(e);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request)||!request.headers.get("content-type")?.includes("application/json"))return json({error:"Ungültige Anfrage."},403);
 try{
  const admin=await getAdminUser();if(!admin)return json({error:"Bitte melde dich an."},401);if(!admin.isModerator)return json({error:"Kein Zugriff auf die Prüfung."},403);
  const body=decisionSchema.parse(await input(request,8192));
  if(body.kind==="claim")await decideClaim(admin,body.id,body.revision,body.decision,body.note);
  else await decideChange(admin,body.id,body.revision,body.decision,body.note);
  return json({ok:true});
 }catch(e){return failure(e);}
}
