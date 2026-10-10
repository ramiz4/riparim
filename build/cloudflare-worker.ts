import { handleMigrationRequest, migrationReadOnly, stampReleaseCommit } from "../lib/migration-export";
import handler from "vinext/server/fetch-handler";
import {servePublicRelease} from "../lib/public-release-routing";
import { stripSitesIdentityHeaders } from "../lib/cloudflare-request";

export default {
  scheduled(_controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    if (!migrationReadOnly(_env)) ctx.waitUntil(import("../lib/notifications/outbox").then(({processNotifications})=>processNotifications()));
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const url=new URL(request.url);
    if(url.hostname==="www.riparim.com")return Response.redirect("https://riparim.com"+url.pathname+url.search,308);
    const publicRelease=await servePublicRelease(request,env);
    if(publicRelease)return stampReleaseCommit(publicRelease);
    const {withNotificationContext}=await import("../lib/notifications/background");
    const migration = await handleMigrationRequest(request, env);
    const result = migration ?? await withNotificationContext(ctx, () => handler.fetch(stripSitesIdentityHeaders(request), env, ctx));
    return stampReleaseCommit(result);
  },
};
