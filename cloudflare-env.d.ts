declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    REVIEW_MODERATOR_EMAIL?: string;
    SITE_ORIGIN?: string;
    EMAIL_LOGIN_ACTIVATION_PROJECT?: string;
    EMAIL_LOGIN_ACTIVATION_TIME?: string;
    SUPABASE_SECRET_KEY?: string;
    RESEND_API_KEY?: string;
    TRANSACTIONAL_EMAIL_FROM?: string;
    GOOGLE_MAPS_BROWSER_API_KEY?: string;
    GOOGLE_PLACES_SERVER_API_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
