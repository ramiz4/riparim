import {ValidationError} from "@/lib/validation-error";
import {getAdminUser} from "@/app/auth";
import {getAuthAdmin} from "@/lib/auth/admin";
import {blockAccount} from "@/lib/auth/account-status";
import {resolveProviderAccount} from "@/lib/auth/identities";
import {registerHistoricalDeletedAccounts} from "@/lib/auth/legacy-supabase";
import {moderatorEmail,storage} from "@/db/storage";
import {json,readJson,sameOrigin} from "@/lib/http";
import {userView,validUserId,parseUserFields,providerFailure,notConfigured} from "@/lib/admin-users";
export const dynamic="force-dynamic";

export async function GET(request:Request){
 try{
  const admin=await getAdminUser();if(!admin)return json({error:"Bitte melde dich an.",errorCode:"authentication_required"},401);if(!admin.isModerator)return json({error:"Kein Zugriff auf die Benutzerverwaltung.",errorCode:"forbidden"},403);
  const params=new URL(request.url).searchParams,page=Number(params.get("page")??1),perPage=Number(params.get("perPage")??20);
  if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isInteger(perPage)||perPage<1||perPage>100)return json({error:"Ungültige Seitenangabe.",errorCode:"invalid_page"},400);
  const auth=await getAuthAdmin();if(!auth)return json({users:[],page,perPage,hasMore:false,configured:false});
  const {data,error}=await auth.client.listUsers({page,perPage});if(error)return providerFailure(error);
  const users=await Promise.all(data.users.map(user=>userView(user,admin,auth)));
  if(auth.provider==="supabase")await registerHistoricalDeletedAccounts(auth.projectUrl);
  const pending=await storage().db.prepare("SELECT s.account_id,i.subject FROM auth_account_status s JOIN auth_identities i ON i.account_id=s.account_id AND i.provider=? AND i.issuer=? WHERE s.status='deleted' AND (EXISTS (SELECT 1 FROM auth_links WHERE account_id=s.account_id) OR EXISTS (SELECT 1 FROM auth_sessions WHERE account_id=s.account_id) OR EXISTS (SELECT 1 FROM auth_account_deletions WHERE account_id=s.account_id) OR EXISTS (SELECT 1 FROM evidence_uploads WHERE owner=s.account_id)) ORDER BY s.account_id LIMIT 100").bind(auth.provider,new URL(auth.projectUrl).origin).all<{account_id:string;subject:string}>();
  const pendingDeletions=pending.results.map(row=>({id:row.subject,email:"",name:`Begonnene Löschung (${row.subject})`,role:"user",active:false,confirmed:false,createdAt:null,lastSignInAt:null,providers:[],protected:row.account_id===admin.userId})).filter(row=>validUserId(row.id));
  return json({users,pendingDeletions,page,perPage,hasMore:data.total!==undefined&&data.total>0?page*perPage<data.total:data.users.length===perPage,configured:true});
 }catch{return providerFailure(null);}
}

export async function POST(request:Request){
 try{
  const admin=await getAdminUser();if(!admin)return json({error:"Bitte melde dich an.",errorCode:"authentication_required"},401);if(!admin.isModerator||!sameOrigin(request))return json({error:"Kein Zugriff auf die Benutzerverwaltung.",errorCode:"forbidden"},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"Ungültige Anfrage.",errorCode:"invalid_request"},400);
  let fields;try{fields=parseUserFields(await readJson(request,8192),true);}catch(e){return json({error:e instanceof ValidationError?e.message:"Bitte prüfe die Eingaben.",errorCode:e instanceof ValidationError?e.code:"invalid_request"},400);}
  if(fields.email===moderatorEmail())return json({error:"Diese E-Mail-Adresse ist für die Verwaltung reserviert.",errorCode:"user_email_reserved"},403);
  const auth=await getAuthAdmin();if(!auth)return notConfigured();
  const {data,error}=await auth.client.createUser({email:fields.email,password:fields.password,name:fields.name,emailVerified:true,active:fields.active});
  if(error||!data.user)return providerFailure(error);
  if(fields.active===false)await blockAccount(await resolveProviderAccount(auth,data.user.identity.subject),"inactive");
  return json({user:await userView(data.user,admin,auth),messageCode:"saved"},201);
 }catch{return providerFailure(null);}
}
