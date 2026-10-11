declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SITE_ADMIN_ENABLED?: string;
    SITE_ORIGIN?: string;
    SITE_INITIAL_SECURITY?: string;
  }
}
