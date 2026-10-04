import {getAdminUser} from "@/app/auth";
import {getAuthAdmin} from "@/lib/auth/admin";
import {blockAccount} from "@/lib/auth/account-status";
import {providerAccountId} from "@/app/auth";
import {moderatorEmail} from "@/db/storage";
import {json,readJson,sameOrigin} from "@/lib/http";
import {userView,parseUserFields,providerFailure,notConfigured} from "@/lib/admin-users";
export const dynamic="force-dynamic";

export async function GET(request:Request){
 try{
  const admin=await getAdminUser();if(!admin)return json({error:"Bitte melde dich an."},401);if(!admin.isModerator)return json({error:"Kein Zugriff auf die Benutzerverwaltung."},403);
  const params=new URL(request.url).searchParams,page=Number(params.get("page")??1),perPage=Number(params.get("perPage")??20);
  if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isInteger(perPage)||perPage<1||perPage>100)return json({error:"Ungültige Seitenangabe."},400);
  const auth=await getAuthAdmin();if(!auth)return json({users:[],page,perPage,hasMore:false,configured:false});
  const {data,error}=await auth.client.auth.admin.listUsers({page,perPage});if(error)return providerFailure(error);
  const users=await Promise.all(data.users.map(user=>userView(user,admin,auth.projectUrl)));
  return json({users,page,perPage,hasMore:data.total>0?page*perPage<data.total:data.users.length===perPage,configured:true});
 }catch{return providerFailure(null);}
}

export async function POST(request:Request){
 try{
  const admin=await getAdminUser();if(!admin)return json({error:"Bitte melde dich an."},401);if(!admin.isModerator||!sameOrigin(request))return json({error:"Kein Zugriff auf die Benutzerverwaltung."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"Ungültige Anfrage."},400);
  let fields;try{fields=parseUserFields(await readJson(request,8192),true);}catch(e){return json({error:e instanceof Error?e.message:"Bitte prüfe die Eingaben."},400);}
  if(fields.email===moderatorEmail())return json({error:"Diese E-Mail-Adresse ist für die Verwaltung reserviert."},403);
  const auth=await getAuthAdmin();if(!auth)return notConfigured();
  const {data,error}=await auth.client.auth.admin.createUser({email:fields.email,password:fields.password,user_metadata:{full_name:fields.name},email_confirm:true,...(fields.active===false?{ban_duration:"876000h"}:{})});
  if(error||!data.user)return providerFailure(error);
  if(fields.active===false)await blockAccount(providerAccountId(auth.projectUrl,data.user.id),"inactive");
  return json({user:await userView(data.user,admin,auth.projectUrl)},201);
 }catch{return providerFailure(null);}
}
