import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { lifeSecurity, lifeSessions } from "@/db/schema";

const ALGORITHM = "scrypt-N32768-r8-p3-v1";
const SESSION_SECONDS = 12 * 60 * 60;
const COOKIE_NAME = "life_session";
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function getD1() { if (!env.DB) throw new Error("D1 binding unavailable"); return env.DB; }

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, 32, SCRYPT_OPTIONS, (error, result) => error ? reject(error) : resolve(result as Buffer)));
}
function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}
function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
function getCookieToken(cookieHeader: string | null): string | null {
  const value = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return value && /^[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : null;
}
function hashToken(token: string): string { return createHash("sha256").update(token, "utf8").digest("hex"); }
async function getSecurity() {
  const [row] = await getDb().select().from(lifeSecurity).where(eq(lifeSecurity.id, 1)).limit(1);
  return row ?? null;
}
async function pruneExpiredSessions() {
  await getDb().delete(lifeSessions).where(lte(lifeSessions.expiresAt, new Date().toISOString()));
}
export async function getLifePasswordConfigured(): Promise<boolean> {
  await pruneExpiredSessions();
  return Boolean(await getSecurity());
}

export async function isLifeUnlocked(cookieHeader: string | null): Promise<boolean> {
  await pruneExpiredSessions();
  const token = getCookieToken(cookieHeader);
  if (!token) return false;
  const security = await getSecurity();
  if (!security) return false;
  const db = getDb(), now = new Date().toISOString();
  const [session] = await db.select({ tokenHash: lifeSessions.tokenHash }).from(lifeSessions).where(and(
    eq(lifeSessions.tokenHash, hashToken(token)), eq(lifeSessions.version, security.version), gt(lifeSessions.expiresAt, now),
  )).limit(1);
  return Boolean(session);
}

export async function getLifeAccessState(cookieHeader: string | null): Promise<{ configured: boolean; unlocked: boolean }> {
  const configured = await getLifePasswordConfigured();
  return { configured, unlocked: configured && await isLifeUnlocked(cookieHeader) };
}

export type LifePasswordCheck = { status: "ok"; token: string } | { status: "wrong" | "unconfigured" } | { status: "locked"; retryAfter: number };
export async function verifyLifePassword(password: string): Promise<LifePasswordCheck> {
  await pruneExpiredSessions();
  const security = await getSecurity();
  if (!security) return { status: "unconfigured" };
  const nowDate = new Date();
  if (security.lockedUntil) {
    const lockedUntilMs = Date.parse(security.lockedUntil);
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > nowDate.getTime()) return { status: "locked", retryAfter: Math.max(1, Math.ceil((lockedUntilMs - nowDate.getTime()) / 1000)) };
  }
  if (security.algorithm !== ALGORITHM || !/^[0-9a-f]{32}$/i.test(security.salt) || !/^[0-9a-f]{64}$/i.test(security.passwordHash)) return { status: "unconfigured" };
  const actual = await derive(password, Buffer.from(security.salt, "hex"));
  const expected = Buffer.from(security.passwordHash, "hex");
  const matches = timingSafeEqual(actual, expected);
  const now = nowDate.toISOString();
  if (!matches) {
    const lockUntil = new Date(nowDate.getTime() + 60_000).toISOString();
    const result = await getD1().prepare(`UPDATE life_security
      SET failed_attempts = CASE WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1 ELSE failed_attempts + 1 END,
          locked_until = CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1 ELSE failed_attempts + 1 END) >= 5 THEN ? ELSE NULL END
      WHERE id = 1 AND version = ? AND (locked_until IS NULL OR locked_until <= ?)`)
      .bind(now, now, lockUntil, security.version, now).run();
    if ((result.meta?.changes ?? 0) === 0) {
      const current = await getSecurity();
      const expires = current?.lockedUntil ? Date.parse(current.lockedUntil) : NaN;
      if (Number.isFinite(expires) && expires > Date.now()) return { status: "locked", retryAfter: Math.max(1, Math.ceil((expires - Date.now()) / 1000)) };
    }
    return { status: "wrong" };
  }
  const reset = await getD1().prepare("UPDATE life_security SET failed_attempts = 0, locked_until = NULL WHERE id = 1 AND version = ? AND password_hash = ?")
    .bind(security.version, security.passwordHash).run();
  if ((reset.meta?.changes ?? 0) === 0) return { status: "wrong" };
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await getDb().insert(lifeSessions).values({ tokenHash: hashToken(token), version: security.version, expiresAt });
  return { status: "ok", token };
}

export async function setLifePassword(password: string): Promise<void> {
  const salt = randomBytes(16), hash = await derive(password, salt), version = randomUUID();
  await getD1().batch([
    getD1().prepare(`INSERT INTO life_security (id, password_hash, salt, algorithm, version, failed_attempts, locked_until)
      VALUES (1, ?, ?, ?, ?, 0, NULL)
      ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt,
        algorithm = excluded.algorithm, version = excluded.version, failed_attempts = 0, locked_until = NULL`)
      .bind(hash.toString("hex"), salt.toString("hex"), ALGORITHM, version),
    getD1().prepare("DELETE FROM life_sessions"),
  ]);
}

export async function revokeLifeSession(cookieHeader: string | null): Promise<void> {
  const token = getCookieToken(cookieHeader);
  if (token) await getDb().delete(lifeSessions).where(eq(lifeSessions.tokenHash, hashToken(token)));
}
export function lifeSessionSetCookie(token: string, request: Request): string { return sessionCookie(token, request); }
export function lifeSessionClearCookie(request: Request): string { return clearSessionCookie(request); }
