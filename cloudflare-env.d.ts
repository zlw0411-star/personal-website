declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MEDIA?: KVNamespace;
    SITE_ADMIN_ENABLED?: string;
    SITE_ORIGIN?: string;
    SITE_INITIAL_SECURITY?: string;
  }
}
