import handler from "vinext/server/fetch-handler";
import { stripSitesIdentityHeaders } from "../lib/cloudflare-request";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handler.fetch(stripSitesIdentityHeaders(request), env, ctx);
  },
};
