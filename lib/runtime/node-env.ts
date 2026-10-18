import { currentNodeClientAddress } from "./node-request";
import { createNodeStorage } from "./node-storage";
import type { RuntimeEnv } from "./contracts";
let storage: ReturnType<typeof createNodeStorage> | undefined;
const configuration = [
  "SITE_ORIGIN",
  "POSTHOG_KEY",
  "POSTHOG_HOST",
  "POSTHOG_TEST_MODE",
  "REVIEW_MODERATOR_EMAIL",
  "GOOGLE_MAPS_BROWSER_API_KEY",
  "GOOGLE_PLACES_SERVER_API_KEY",
  "EMAIL_LOGIN_ACTIVATION_TIME",
  "EMAIL_LOGIN_ACTIVATION_PROJECT",
  "AUTH_TRUSTED_ORIGIN",
  "AUTH_TRUSTED_PROVIDER",
  "AUTH_ADMIN_KEY",
  "AUTH_ADMIN_KEY_ORIGIN",
  "AUTH_ADMIN_KEY_PROVIDER",
  "SUPABASE_SECRET_KEY_ORIGIN",
  "SUPABASE_SECRET_KEY",
  "RESEND_API_KEY",
  "TRANSACTIONAL_EMAIL_FROM",
  "EMAIL_TRANSPORT",
  "SMTP_URL",
  "SMTP_SECRET_ORIGIN",
  "MIGRATION_READ_ONLY",
  "MIGRATION_EXPORT_EXPIRES_AT",
  "MIGRATION_EXPORT_TOKEN_SHA256",
  "MIGRATION_SOURCE_COMMIT",
] as const;
export const env: RuntimeEnv = new Proxy(
  {},
  {
    get(_target, key) {
      if (key === "DB" || key === "BUCKET") {
        storage ??= createNodeStorage(
          process.env.RIPARIM_DATA_DIR ?? ".riparim",
        );
        return key === "DB" ? storage.db : storage.bucket;
      }
      return configuration.includes(key as (typeof configuration)[number])
        ? process.env[String(key)]
        : undefined;
    },
  },
);
export function nativeIdentityEnabled() {
  return false;
}

export function clientAddress() {
  return currentNodeClientAddress();
}
