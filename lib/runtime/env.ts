// Cloudflare is the default production adapter. The Node build selects node-env.
import { env as cloudflareEnv } from "cloudflare:workers";
import type { RuntimeEnv } from "./contracts";
export const env: RuntimeEnv = cloudflareEnv;
// Only Sites has a trusted native identity edge. The owned Worker strips its
// headers before application dispatch; the Node adapter disables it entirely.
export function nativeIdentityEnabled() {
  return true;
}

export function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
