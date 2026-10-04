import { handleMigrationRequest, migrationReadOnly } from "../lib/migration-export";
import { withNotificationContext } from "../lib/notifications/background";
import { processNotifications } from "../lib/notifications/outbox";
import handler from "vinext/server/fetch-handler";
import { stripSitesIdentityHeaders } from "../lib/cloudflare-request";

export default {
  scheduled(_controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    if (!migrationReadOnly(_env)) ctx.waitUntil(processNotifications());
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const migration = await handleMigrationRequest(request, env);
    if (migration) return migration;
    return withNotificationContext(ctx, () => handler.fetch(stripSitesIdentityHeaders(request), env, ctx));
  },
};
