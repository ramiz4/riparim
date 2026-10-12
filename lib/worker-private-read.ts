import {accountReadResponse} from "./account-read";
import {businessReadResponse} from "./business-read";
import {visitsReadResponse} from "./visits-read";
import {finishWorkerRead,workerReadAuth} from "./worker-read-auth";
import type {AppUser} from "./auth/app-user";

export async function workerPrivateReadResponse(request:Request){
 const cookieHeaders=new Headers(),context=workerReadAuth(request,cookieHeaders);
 const auth={
  getAppUser:async()=>(await context).getAppUser(),
  getAdminUser:async(current?:AppUser|null)=>(await context).getAdminUser(current),
 };
 const path=new URL(request.url).pathname;
 const response=path==="/api/business"?await businessReadResponse(request,auth):path==="/api/visits"?await visitsReadResponse(request,auth):await accountReadResponse({
  currentAccount:async()=>(await context).currentAccount(),
  getAuthConfig:async()=>(await context).getAuthConfig(),
  readDeletionGrant:async()=>(await context).readDeletionGrant(),
 });
 return finishWorkerRead(response,cookieHeaders);
}
