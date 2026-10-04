declare namespace Cloudflare {
  interface Env {
    MIGRATION_READ_ONLY?: string;
    MIGRATION_EXPORT_TOKEN_SHA256?: string;
    MIGRATION_EXPORT_EXPIRES_AT?: string;
    MIGRATION_SOURCE_COMMIT?: string;
    EMAIL_LOGIN_ACTIVATION_PROJECT?: string;
    EMAIL_LOGIN_ACTIVATION_TIME?: string;
    SUPABASE_SECRET_KEY?: string;
    RESEND_API_KEY?: string;
    TRANSACTIONAL_EMAIL_FROM?: string;
    GOOGLE_MAPS_BROWSER_API_KEY?: string;
    GOOGLE_PLACES_SERVER_API_KEY?: string;
  }
}
