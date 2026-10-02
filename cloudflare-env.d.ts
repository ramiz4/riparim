declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    REVIEW_MODERATOR_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
