import { withNotificationContext } from "../lib/notifications/background";
import { processNotifications } from "../lib/notifications/outbox";
import handler from "vinext/server/fetch-handler";
import { stripSitesIdentityHeaders } from "../lib/cloudflare-request";

export default {
  scheduled(_controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    ctx.waitUntil(processNotifications());
  },
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return withNotificationContext(ctx, () => handler.fetch(stripSitesIdentityHeaders(request), env, ctx));
  },
};
