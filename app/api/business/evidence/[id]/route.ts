import {callbackLocale} from "@/lib/auth/locale";
import {createTranslator,getMessages} from "@/lib/i18n/messages";
import {getAppUser,getAdminUser,ownerPair} from "@/app/auth";
import {storage} from "@/db/storage";

export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const t=createTranslator(getMessages(callbackLocale(new URL(request.url).searchParams.get("locale")),["customer"]));
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 const user=await getAppUser()??await getAdminUser();
 if(!user)return new Response(t("customer.downloadAuth"),{status:401,headers});
 try{
  const {id}=await params,{db,bucket}=storage();
  const claim=await db.prepare("SELECT owner,file_key,file_type FROM workshop_claims WHERE id=?").bind(id).first<{owner:string;file_key:string|null;file_type:string|null}>();
  if(!claim||(!ownerPair(user).includes(claim.owner)&&!(await getAdminUser(user))?.isModerator))return new Response(t("customer.downloadNotFound"),{status:404,headers});
  if(!claim.file_key)return new Response(t("customer.downloadNoDocument"),{status:404,headers});
  const file=await bucket.get(claim.file_key);
  if(!file)return new Response(t("customer.downloadMissing"),{status:404,headers});
  const extension=claim.file_type==="application/pdf"?"pdf":claim.file_type==="image/png"?"png":"jpg";
  return new Response(file.body,{headers:{...headers,"Content-Type":claim.file_type??"application/octet-stream","Content-Disposition":`attachment; filename="inhabernachweis.${extension}"`}});
 }catch{console.error("claim-evidence-read-failed");return new Response(t("customer.downloadUnavailable"),{status:503,headers});}
}
