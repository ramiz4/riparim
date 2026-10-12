import {workerSessionResponse} from "../lib/worker-session";
import {workerPrivateReadResponse} from "../lib/worker-private-read";
import {authOptionsResponse} from "../lib/auth-options";
import {serveDeferredPage} from "../lib/deferred-page-routing";
import { handleMigrationRequest, stampReleaseCommit } from "../lib/migration-export";
import {servePublicRelease} from "../lib/public-release-routing";
import {isPagePath,isTechnicalPath} from "../lib/i18n/locale";
import { stripSitesIdentityHeaders } from "../lib/cloudflare-request";
import {withAuthRequest} from "../lib/auth/request-context";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const url=new URL(request.url);
    if(url.hostname==="www.riparim.com")return Response.redirect("https://riparim.com"+url.pathname+url.search,308);
    if(/^\/de(?:\/|$)/.test(url.pathname)){url.pathname=url.pathname.slice(3)||"/";return stampReleaseCommit(new Response(null,{status:308,headers:{Location:url.href,"Cache-Control":"private, no-store"}}));}
    const deferred=await serveDeferredPage(request,env);
    if(deferred)return stampReleaseCommit(deferred);
    const publicRelease=await servePublicRelease(request,env);
    if(publicRelease)return stampReleaseCommit(publicRelease);
    const migration = await handleMigrationRequest(request, env);
    if(migration)return stampReleaseCommit(migration);
    if(!isTechnicalPath(url.pathname)&&!isPagePath(url.pathname))return stampReleaseCommit(new Response("Not Found",{status:404,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"}}));
    // The owned Worker has no header-based native identity. With no cookies
    // there can be no authenticated session; avoid loading React for guests.
    if(url.pathname==="/api/session"&&request.method==="GET"&&!request.headers.has("Cookie"))return stampReleaseCommit(Response.json({account:null,isAdmin:false},{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"}}));
    if(url.pathname==="/api/auth-options"&&request.method==="GET")return stampReleaseCommit(await authOptionsResponse());
    if(url.pathname==="/api/session"&&request.method==="GET")return stampReleaseCommit(await withAuthRequest(()=>workerSessionResponse(request)));
    if(request.method==="GET"&&["/api/business","/api/visits","/api/account"].includes(url.pathname))return stampReleaseCommit(await withAuthRequest(()=>workerPrivateReadResponse(stripSitesIdentityHeaders(request))));
    if(url.pathname==="/api/workshops"&&request.method==="GET"&&url.searchParams.get("admin")!=="1")return stampReleaseCommit(await (await import("../lib/public-workshops")).publicWorkshopResponse(request));
    const handler=(await import("vinext/server/fetch-handler")).default;
    const result = await withAuthRequest(()=>handler.fetch(stripSitesIdentityHeaders(request), env, ctx),request.headers.get("RSC")==="1"||!!request.headers.get("Accept")?.includes("text/x-component"));
    return stampReleaseCommit(result);
  },
};
