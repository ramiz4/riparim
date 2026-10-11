import {NextResponse,type NextRequest} from "next/server";
import {createAuthClient} from "@/lib/auth/provider";
import {getAuthConfig} from "@/lib/auth/config";
import {publishedWorkshop} from "@/db/directory";
import {isTechnicalPath,isPagePath,isStaticOrMetadataPath,localeFromPath,localizeHref,pageIdentityPath} from "@/lib/i18n/locale";

export async function proxy(request:NextRequest){
 const canonical=new URL(request.url);
 if(canonical.hostname==="www.riparim.com"){
  canonical.hostname="riparim.com";canonical.protocol="https:";
  const redirect=NextResponse.redirect(canonical,308);redirect.headers.set("Cache-Control","private, no-store");return redirect;
 }
 if(/^\/de(?:\/|$)/.test(canonical.pathname)){
  canonical.pathname=canonical.pathname.slice(3)||"/";
  const redirect=NextResponse.redirect(canonical,308);redirect.headers.set("Cache-Control","private, no-store");return redirect;
 }
 // Vinext beta.5 can return a rewritten route miss as a 200 text response.
 // Reject unknown page paths before handing the native locale route to Vinext.
 if(!isTechnicalPath(canonical.pathname)&&!isPagePath(canonical.pathname))return new Response("Not Found",{status:404,headers:{"X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Cache-Control":"private, no-store"}});
 const page=!isTechnicalPath(canonical.pathname);
 if(page){
  const localized=localizeHref(canonical.pathname,localeFromPath(canonical.pathname));
  if(localized!==canonical.pathname){
   canonical.pathname=localized;
   const redirect=NextResponse.redirect(canonical,308);redirect.headers.set("Cache-Control","private, no-store");return redirect;
  }
 }
 const destination=new URL(canonical);
 if(page){const identity=pageIdentityPath(canonical.pathname);destination.pathname=`/${localeFromPath(canonical.pathname)}${identity==="/"?"":identity}`;}
 const rewrite=destination.pathname!==canonical.pathname;
 const profileId=page?pageIdentityPath(canonical.pathname).match(/^\/werkstatt\/([^/]+)$/)?.[1]:undefined;
 // Decide before RSC streaming starts; keep the route's localized not-found UI.
 const status=profileId&&(!/^[a-z0-9][a-z0-9-]{2,80}$/.test(profileId)||!await publishedWorkshop(profileId))?404:undefined;
 const referrerPolicy=["/auth/bestaetigen","/auth/bestaetigen/"].includes(canonical.pathname)?"no-referrer":"strict-origin-when-cross-origin";
 // Cookie renewal must reconstruct the same response plan, including its rewrite.
 const createResponse=()=>{
  const response=rewrite?NextResponse.rewrite(destination,{request,status}):NextResponse.next({request,status});
  response.headers.set("X-Content-Type-Options","nosniff");response.headers.set("Referrer-Policy",referrerPolicy);response.headers.set("Cache-Control","private, no-store");
  return response;
 };
 let response=createResponse();
 // Physical files and technical metadata do not require an auth database or provider.
 if(isStaticOrMetadataPath(canonical.pathname))return response;
 const c=await getAuthConfig();if(!c?.enabled)return response;
 const local=["localhost","127.0.0.1"].includes(canonical.hostname);
 const client=createAuthClient(c,{getAll(){return request.cookies.getAll();},setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=createResponse();values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}},!local);
 await client.auth.getUser();return response;
}
export const config={matcher:["/((?!_next/static|_next/image).*)"]};
