import { env } from "@/lib/runtime/env";
import { createAuthAdminClient, validSupabaseSecret } from "./provider";
import { authSecretMatchesOrigin } from "./origin";
import { getAuthConfig } from "./config";
export async function getAuthAdmin() {
  const config = await getAuthConfig(),
    key =
      env.AUTH_ADMIN_KEY?.trim() ??
      (config?.provider === "supabase"
        ? env.SUPABASE_SECRET_KEY?.trim()
        : undefined);
  if (
    !config ||
    !key ||
    !authSecretMatchesOrigin(config.projectUrl, config.provider) ||
    (config.provider === "supabase" && !validSupabaseSecret(key))
  )
    return null;
  return {
    client: createAuthAdminClient(config, key),
    projectUrl: config.projectUrl,
    provider: config.provider,
  };
}
