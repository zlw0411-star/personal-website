import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { adminSecurity, adminSessions } from "@/db/schema";

const ALGORITHM = "scrypt-N32768-r8-p3-v1";
const SESSION_SECONDS = 12 * 60 * 60;
const COOKIE_NAME = "admin_session";
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function getD1() { if (!env.DB) throw new Error("D1 binding unavailable"); return env.DB; }
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, 32, SCRYPT_OPTIONS, (error, result) => error ? reject(error) : resolve(result as Buffer)));
}
function hashToken(token: string): string { return createHash("sha256").update(token, "utf8").digest("hex"); }
function parseToken(cookieHeader: string | null): string | null {
  const value = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return value && /^[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : null;
}
async function getSecurity() {
  const [row] = await getDb().select().from(adminSecurity).where(eq(adminSecurity.id, 1)).limit(1);
  return row ?? null;
}
async function pruneExpiredSessions() {
  await getDb().delete(adminSessions).where(lte(adminSessions.expiresAt, new Date().toISOString()));
}
export async function isAdminAuthenticated(cookieHeader: string | null): Promise<boolean> {
  await pruneExpiredSessions();
  const token = parseToken(cookieHeader);
  if (!token) return false;
  const security = await getSecurity();
  if (!security) return false;
  const now = new Date().toISOString();
  const [session] = await getDb().select({ tokenHash: adminSessions.tokenHash }).from(adminSessions).where(and(
    eq(adminSessions.tokenHash, hashToken(token)), eq(adminSessions.version, security.version), gt(adminSessions.expiresAt, now),
  )).limit(1);
  return Boolean(session);
}
export async function getAdminAccessState(cookieHeader: string | null): Promise<{ configured: boolean; authenticated: boolean }> {
  await pruneExpiredSessions();
  const configured = Boolean(await getSecurity());
  return { configured, authenticated: configured && await isAdminAuthenticated(cookieHeader) };
}

export type AdminPasswordCheck = { status: "ok"; token: string } | { status: "wrong" | "unconfigured" } | { status: "locked"; retryAfter: number };
export async function verifyAdminPassword(password: string): Promise<AdminPasswordCheck> {
  await pruneExpiredSessions();
  const security = await getSecurity();
  if (!security) return { status: "unconfigured" };
  const nowDate = new Date();
  if (security.lockedUntil) {
    const lockedUntil = Date.parse(security.lockedUntil);
    if (Number.isFinite(lockedUntil) && lockedUntil > nowDate.getTime()) return { status: "locked", retryAfter: Math.max(1, Math.ceil((lockedUntil - nowDate.getTime()) / 1000)) };
  }
  if (security.algorithm !== ALGORITHM || !/^[0-9a-f]{32}$/i.test(security.salt) || !/^[0-9a-f]{64}$/i.test(security.passwordHash)) return { status: "unconfigured" };
  const actual = await derive(password, Buffer.from(security.salt, "hex"));
  const expected = Buffer.from(security.passwordHash, "hex");
  if (!timingSafeEqual(actual, expected)) {
    const now = nowDate.toISOString(), lockUntil = new Date(nowDate.getTime() + 60_000).toISOString();
    const result = await getD1().prepare(`UPDATE admin_security
      SET failed_attempts = CASE WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1 ELSE failed_attempts + 1 END,
          locked_until = CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1 ELSE failed_attempts + 1 END) >= 5 THEN ? ELSE NULL END
      WHERE id = 1 AND version = ? AND (locked_until IS NULL OR locked_until <= ?)`)
      .bind(now, now, lockUntil, security.version, now).run();
    if ((result.meta?.changes ?? 0) === 0) {
      const current = await getSecurity(), expires = current?.lockedUntil ? Date.parse(current.lockedUntil) : NaN;
      if (Number.isFinite(expires) && expires > Date.now()) return { status: "locked", retryAfter: Math.max(1, Math.ceil((expires - Date.now()) / 1000)) };
    }
    return { status: "wrong" };
  }
  const reset = await getD1().prepare("UPDATE admin_security SET failed_attempts = 0, locked_until = NULL WHERE id = 1 AND version = ? AND password_hash = ?")
    .bind(security.version, security.passwordHash).run();
  if ((reset.meta?.changes ?? 0) === 0) return { status: "wrong" };
  const token = randomBytes(32).toString("hex"), expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await getDb().insert(adminSessions).values({ tokenHash: hashToken(token), version: security.version, expiresAt });
  return { status: "ok", token };
}

export function adminSessionSetCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}
export function adminSessionClearCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
export async function revokeAdminSession(cookieHeader: string | null): Promise<void> {
  const token = parseToken(cookieHeader);
  if (token) await getDb().delete(adminSessions).where(eq(adminSessions.tokenHash, hashToken(token)));
}
