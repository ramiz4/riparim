import {NextResponse,type NextRequest} from "next/server";
import {createServerClient} from "@supabase/ssr";
import {getAuthConfig} from "@/lib/auth/config";
import {isTechnicalPath,isPagePath,isStaticOrMetadataPath} from "@/lib/i18n/locale";

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
 const rewrite=!/^\/(?:sq|en)(?:\/|$)/.test(canonical.pathname)&&!isTechnicalPath(canonical.pathname);
 const destination=new URL(canonical);
 if(rewrite)destination.pathname=`/de${canonical.pathname==="/"?"":canonical.pathname}`;
 const referrerPolicy=["/auth/bestaetigen","/auth/bestaetigen/"].includes(canonical.pathname)?"no-referrer":"strict-origin-when-cross-origin";
 // Cookie renewal must reconstruct the same response plan, including its rewrite.
 const createResponse=()=>{
  const response=rewrite?NextResponse.rewrite(destination,{request}):NextResponse.next({request});
  response.headers.set("X-Content-Type-Options","nosniff");response.headers.set("Referrer-Policy",referrerPolicy);response.headers.set("Cache-Control","private, no-store");
  return response;
 };
 let response=createResponse();
 // Physical files and technical metadata do not require an auth database or provider.
 if(isStaticOrMetadataPath(canonical.pathname))return response;
 const c=await getAuthConfig();if(!c?.enabled)return response;
 const local=["localhost","127.0.0.1"].includes(canonical.hostname);
 const client=createServerClient(c.projectUrl,c.publicKey,{cookieOptions:{httpOnly:true,secure:!local,sameSite:"lax",path:"/"},cookies:{getAll(){return request.cookies.getAll();},setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=createResponse();values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 await client.auth.getUser();return response;
}
export const config={matcher:["/((?!_next/static|_next/image).*)"]};
