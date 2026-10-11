import { env } from "cloudflare:workers";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseOrigin(value: string | null | undefined): URL | null {
  if (!value || value.length > 512) return null;
  try {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname.toLowerCase()))) return null;
    return url;
  } catch {
    return null;
  }
}

export function isAdminOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (import.meta.env.DEV) {
    const url = parseOrigin(origin);
    return Boolean(url && LOOPBACK_HOSTS.has(url.hostname.toLowerCase()));
  }
  if (env.SITE_ADMIN_ENABLED !== "true") return false;
  const configuredOrigin = parseOrigin(env.SITE_ORIGIN);
  return Boolean(configuredOrigin && origin === configuredOrigin.origin);
}

export function requestOrigin(request: Request): string | null {
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export function layoutRequestOrigin(headers: Headers): string | null {
  const host = headers.get("host") ?? headers.get("x-forwarded-host");
  if (!host || /[,\s/@?#\\]/u.test(host)) return null;

  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedProto !== null && forwardedProto !== "http" && forwardedProto !== "https") return null;
  if (forwardedProto === null && !import.meta.env.DEV) {
    const configured = parseOrigin(env.SITE_ORIGIN);
    if (!configured) return null;
    try {
      if (new URL(`https://${host}`).host !== configured.host) return null;
      return configured.origin;
    } catch {
      return null;
    }
  }

  try {
    const protocol = forwardedProto ?? "http";
    const url = new URL(`${protocol}://${host}`);
    return url.origin;
  } catch {
    return null;
  }
}
