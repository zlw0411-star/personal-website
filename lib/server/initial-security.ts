import { env } from "cloudflare:workers";

const ALGORITHM = "scrypt-N32768-r8-p3-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SecuritySeed = { algorithm: string; salt: string; passwordHash: string; version: string };
type InitialSecurity = { admin: SecuritySeed; life: SecuritySeed };
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function parseSeed(value: unknown): SecuritySeed | null {
  if (!isRecord(value) || !hasExactKeys(value, ["algorithm", "salt", "passwordHash", "version"])) return null;
  if (value.algorithm !== ALGORITHM || typeof value.salt !== "string" || !/^[0-9a-f]{32}$/i.test(value.salt)) return null;
  if (typeof value.passwordHash !== "string" || !/^[0-9a-f]{64}$/i.test(value.passwordHash)) return null;
  if (typeof value.version !== "string" || !UUID.test(value.version)) return null;
  return { algorithm: value.algorithm, salt: value.salt, passwordHash: value.passwordHash, version: value.version };
}
function parseInitialSecurity(value: string | undefined): InitialSecurity | null {
  if (!value || value.length > 4096) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || !hasExactKeys(parsed, ["admin", "life"])) return null;
    const admin = parseSeed(parsed.admin), life = parseSeed(parsed.life);
    return admin && life ? { admin, life } : null;
  } catch {
    return null;
  }
}

let initialization: Promise<void> | undefined;

export function initializeSecurityIfNeeded(): Promise<void> {
  // Local databases retain their existing setup and are never seeded from runtime secrets.
  if (import.meta.env.DEV) return Promise.resolve();
  const seeds = parseInitialSecurity(env.SITE_INITIAL_SECURITY);
  if (!seeds || !env.DB) return Promise.resolve();
  initialization ??= env.DB.batch([
    env.DB.prepare(`INSERT INTO admin_security (id, password_hash, salt, algorithm, version, failed_attempts, locked_until)
      VALUES (1, ?, ?, ?, ?, 0, NULL) ON CONFLICT(id) DO NOTHING`)
      .bind(seeds.admin.passwordHash, seeds.admin.salt, seeds.admin.algorithm, seeds.admin.version),
    env.DB.prepare(`INSERT INTO life_security (id, password_hash, salt, algorithm, version, failed_attempts, locked_until)
      VALUES (1, ?, ?, ?, ?, 0, NULL) ON CONFLICT(id) DO NOTHING`)
      .bind(seeds.life.passwordHash, seeds.life.salt, seeds.life.algorithm, seeds.life.version),
  ]).then(() => undefined).catch(error => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}
