import {ValidationError} from "@/lib/validation-error";
import {z} from "zod";
import {getAppUser,getAdminUser} from "@/app/auth";
import {json,readJson,readFormData,sameOrigin} from "@/lib/http";
import {businessProfileSchema,claimSchema,claimUploadRequestLimit} from "@/lib/business-contract";
import {BusinessError,businessState,requestWorkshopClaim,requestWorkshopChange,decideClaim,decideChange} from "@/lib/business";

export const dynamic="force-dynamic";
const id=z.string().uuid();
const createSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("claim"),input:claimSchema}).strict(),
 z.object({kind:z.literal("change"),workshopId:z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/),profile:businessProfileSchema}).strict()
]);
const decisionSchema=z.object({kind:z.enum(["claim","change"]),id,revision:z.number().int().nonnegative(),decision:z.enum(["approved","rejected"]),note:z.string().trim().min(10).max(2000)}).strict();
async function input(request:Request,maxBytes:number){try{return await readJson(request,maxBytes);}catch{throw new BusinessError("Ungültige Eingaben.",400,"invalid_request");}}
function failure(error:unknown){
 if(error instanceof BusinessError)return json({error:error.message,errorCode:error.code},error.status);
 if(error instanceof ValidationError)return json({error:error.message,errorCode:error.code},error.code==="file_too_large"?413:400);
 if(error instanceof z.ZodError)return json({error:"Bitte prüfe deine Eingaben und den Inhabernachweis.",errorCode:"business_invalid_input"},400);
 console.error("business-operation-failed",error instanceof Error?error.name:"unknown");
 return json({error:"Der Betriebsbereich ist gerade nicht verfügbar. Deine Eingaben bleiben erhalten.",errorCode:"business_unavailable"},503);
}
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams,moderation=params.get("moderation")==="1",user=moderation?await getAdminUser():await getAppUser();
  if(!user)return json({error:"Bitte melde dich an.",errorCode:"authentication_required"},401);
  if(moderation&&!user.isModerator)return json({error:"Kein Zugriff auf die Prüfung.",errorCode:"forbidden"},403);
  return json(await businessState(user,moderation,{claims:params.get("claimCursor"),changes:params.get("changeCursor")}));
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request)||!["application/json","multipart/form-data"].some(type=>request.headers.get("content-type")?.includes(type)))return json({error:"Ungültige Anfrage.",errorCode:"invalid_request"},403);
 try{
  const user=await getAppUser();if(!user)return json({error:"Bitte melde dich an.",errorCode:"authentication_required"},401);
  if(request.headers.get("content-type")?.includes("multipart/form-data")){
   let form:FormData;try{form=await readFormData(request,claimUploadRequestLimit);}catch(error){if(error instanceof Error&&error.message==="INPUT_TOO_LARGE")throw new BusinessError("Die Dokumente sind zusammen zu groß. Maximal 10 MB.",413,"business_documents_too_large");throw new BusinessError("Ungültige Eingaben.",400,"invalid_request");}
   if([...form.keys()].some(key=>!["workshopId","evidence","file"].includes(key))||["workshopId","evidence"].some(key=>form.getAll(key).length>1))throw new BusinessError("Ungültige Eingaben.",400,"business_invalid_input");
   const files=form.getAll("file");if(files.some(file=>typeof file==="string"))throw new ValidationError("invalid_file","Bitte lade eine gültige Datei hoch.");
   const created=await requestWorkshopClaim(user,{workshopId:form.get("workshopId"),evidence:form.get("evidence")},files as File[]);
   return json({id:created,status:"pending",messageCode:"saved"},201);
  }
  const body=createSchema.parse(await input(request,16000));
  const created=body.kind==="claim"?await requestWorkshopClaim(user,body.input):await requestWorkshopChange(user,body.workshopId,body.profile);
  return json({id:created,status:"pending",messageCode:"saved"},201);
 }catch(e){return failure(e);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request)||!request.headers.get("content-type")?.includes("application/json"))return json({error:"Ungültige Anfrage.",errorCode:"invalid_request"},403);
 try{
  const admin=await getAdminUser();if(!admin)return json({error:"Bitte melde dich an.",errorCode:"authentication_required"},401);if(!admin.isModerator)return json({error:"Kein Zugriff auf die Prüfung.",errorCode:"forbidden"},403);
  const body=decisionSchema.parse(await input(request,8192));
  if(body.kind==="claim")await decideClaim(admin,body.id,body.revision,body.decision,body.note);
  else await decideChange(admin,body.id,body.revision,body.decision,body.note);
  return json({ok:true,messageCode:"saved"});
 }catch(e){return failure(e);}
}
