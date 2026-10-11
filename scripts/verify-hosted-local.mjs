import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const id = randomUUID(), port = 4176, origin = `http://127.0.0.1:${port}`;
const qaDir = path.join(root, ".sites-runtime", `hosted-qa-${id}`);
const stateDir = path.join(qaDir, "state"), cfHome = path.join(qaDir, "cf-home");
const builtConfig = path.join(root, "dist", "server", "wrangler.json");
const qaConfig = path.join(path.dirname(builtConfig), `wrangler.hosted-qa-${id}.json`);
const assertions = [];
let child = null, password = `Hosted-QA-${randomUUID()}-fixture`;
const derive = promisify(scryptCallback), hashOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function check(ok, label) { assertions.push({ label, passed: Boolean(ok) }); if (!ok) throw new Error("assertion failed"); }
async function freePort() {
  const code = await new Promise(resolve => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const timer = setTimeout(() => { socket.destroy(); resolve("timeout"); }, 700);
    socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolve("open"); });
    socket.once("error", error => { clearTimeout(timer); resolve(error.code); });
  });
  if (code !== "ECONNREFUSED") throw new Error("port 4176 is occupied or unavailable");
}
async function seed() {
  const salt = randomBytes(16), passwordHash = (await derive(password, salt, 32, hashOptions)).toString("hex");
  return { algorithm: "scrypt-N32768-r8-p3-v1", salt: salt.toString("hex"), passwordHash, version: randomUUID() };
}
async function writeConfig(vars) {
  const config = JSON.parse(await readFile(builtConfig, "utf8"));
  const db = config.d1_databases?.find(binding => binding.binding === "DB");
  if (!db || !config.r2_buckets?.some(binding => binding.binding === "BUCKET")) throw new Error("built config lacks expected local storage bindings");
  db.migrations_dir = path.join(root, "drizzle");
  config.vars = { ...(config.vars ?? {}), ...vars };
  await writeFile(qaConfig, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
function safeEnv(extra = {}) {
  return Object.fromEntries(["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"].filter(key => process.env[key]).map(key => [key, process.env[key]]).concat([
    ["CI", "1"], ["WRANGLER_SEND_METRICS", "false"], ["HOME", cfHome], ["USERPROFILE", cfHome], ["APPDATA", cfHome], ["LOCALAPPDATA", cfHome], ["CLOUDFLARE_HOME", cfHome], ...Object.entries(extra),
  ]));
}
async function waitExit(proc, timeoutMs) {
  if (proc.exitCode !== null || proc.signalCode !== null) return { code: proc.exitCode, signal: proc.signalCode };
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ timeout: true }), timeoutMs);
    proc.once("exit", (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
    proc.once("error", () => { clearTimeout(timer); resolve({ error: true }); });
  });
}
async function killTree(proc) {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  if (process.platform === "win32") {
    for (let attempt = 0; attempt < 2 && proc.exitCode === null && proc.signalCode === null; attempt++) {
      const killer = spawn("taskkill.exe", ["/PID", String(proc.pid), "/T", "/F"], { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
      await waitExit(killer, 5000); await waitExit(proc, 5000);
    }
  } else proc.kill("SIGTERM");
  if (proc.exitCode === null && proc.signalCode === null && process.platform !== "win32") { proc.kill("SIGKILL"); await waitExit(proc, 3000); }
  if (proc.exitCode === null && proc.signalCode === null) throw new Error("isolated process tree did not exit");
}
async function runCli(args, input = "", timeoutMs = 90_000, extraEnv = {}) {
  const proc = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: safeEnv(extraEnv) });
  proc.stdout.resume(); proc.stderr.resume(); proc.stdin.end(input);
  const result = await waitExit(proc, timeoutMs);
  if (result.timeout) { await killTree(proc); throw new Error("bounded QA child timed out"); }
  if (result.error || result.code !== 0) throw new Error("bounded QA child failed");
}
async function stop() {
  if (!child) return;
  const proc = child;
  await killTree(proc);
  await freePort();
  child = null;
}
async function start(vars, migrate = false) {
  await freePort();
  await writeConfig(vars);
  if (migrate) await runCli([path.join(root, "node_modules", "wrangler", "bin", "wrangler.js"), "d1", "migrations", "apply", "DB", "--local", "--config", qaConfig, "--persist-to", stateDir]);
  child = spawn(process.execPath, [path.join(root, "node_modules", "wrangler", "bin", "wrangler.js"), "dev", "--config", qaConfig, "--local", "--persist-to", stateDir, "--ip", "127.0.0.1", "--port", String(port), "--inspector-port", "0"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: safeEnv(),
  });
  child.stdout.resume(); child.stderr.resume();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("isolated Wrangler process exited before ready");
    try {
      const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(Math.min(15_000, deadline - Date.now())) });
      if (response.ok) return;
    } catch { /* keep polling until the bounded ready deadline */ }
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  throw new Error("isolated Wrangler process did not become ready");
}
async function runAdminCrud() {
  await runCli([path.join(root, "scripts", "verify-admin.mjs")], `${password}\n`, 90_000, { BASE_URL: origin });
}
async function request(route, options = {}) {
  return fetch(`${origin}${route}`, { ...options, signal: AbortSignal.timeout(15_000) });
}
const json = response => response.json().catch(() => ({}));
const sameOrigin = { Origin: origin, "Sec-Fetch-Site": "same-origin" };

try {
  await freePort();
  await mkdir(stateDir, { recursive: true }); await mkdir(cfHome, { recursive: true });
  const [adminSeed, lifeSeed] = await Promise.all([seed(), seed()]);
  const initial = JSON.stringify({ admin: adminSeed, life: lifeSeed });
  const baseVars = { SITE_ADMIN_ENABLED: "true", SITE_ORIGIN: origin };

  await start({ ...baseVars, SITE_INITIAL_SECURITY: initial }, true);
  const home = await request("/"); const homeHtml = await home.text();
  check(home.ok && homeHtml.includes('href="/admin"') && homeHtml.includes("管理内容"), "public page always exposes the admin link");
  const adminPage = await request("/admin"); const adminHtml = await adminPage.text();
  check(adminPage.ok && adminHtml.includes("管理员登录"), "hosted admin route renders its login page");
  check((await request("/api/admin/entries")).status === 401, "anonymous admin API access requires login");
  check((await request("/api/entries?category=life")).status === 401, "anonymous life listing requires unlock");

  const wrongOrigin = await request("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://invalid.example", "Sec-Fetch-Site": "cross-site" }, body: JSON.stringify({ password }) });
  check(wrongOrigin.status === 403, "admin login rejects a non-matching origin");
  const login = await request("/api/admin/auth/login", { method: "POST", headers: { ...sameOrigin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  const loginCookie = login.headers.get("set-cookie") ?? "", adminCookie = loginCookie.split(";")[0];
  check(login.ok && (await json(login)).ok === true && /^admin_session=[0-9a-f]{64}$/i.test(adminCookie) && /httponly/i.test(loginCookie) && /samesite=strict/i.test(loginCookie), "bootstrap creates an HttpOnly strict admin session");
  await runAdminCrud();
  check(true, "isolated admin CRUD and media verification passed");

  const life = await request("/api/life/unlock", { method: "POST", headers: { ...sameOrigin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  const lifeCookieHeader = life.headers.get("set-cookie") ?? "", lifeCookie = lifeCookieHeader.split(";")[0];
  check(life.ok && /^life_session=[0-9a-f]{64}$/i.test(lifeCookie) && /httponly/i.test(lifeCookieHeader) && /samesite=strict/i.test(lifeCookieHeader), "bootstrap creates an HttpOnly strict life session");
  check((await request("/api/admin/entries", { headers: { Cookie: lifeCookie } })).status === 401, "life session does not authorize admin APIs");
  const entry = { category: "life", status: "draft", visibility: "private", title: `hosted QA ${id}`, summary: "isolated fixture", projectUrl: "", repositoryUrl: "", coverId: null, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "isolated fixture" }] }] } };
  const created = await request("/api/admin/entries", { method: "POST", headers: { ...sameOrigin, "Content-Type": "application/json", Cookie: adminCookie }, body: JSON.stringify(entry) });
  const entryId = (await json(created)).entry?.id;
  check(created.status === 201 && typeof entryId === "string", "admin can create an isolated draft fixture");
  check((await request(`/api/entries/${entryId}`)).status === 404, "draft entry remains hidden from public API");
  const locked = await request("/api/life/lock", { method: "POST", headers: { ...sameOrigin, Cookie: lifeCookie } });
  check(locked.ok && (await request("/api/life/status", { headers: { Cookie: lifeCookie } }).then(json)).unlocked === false, "life lock revokes the isolated life session");

  await stop();
  await start(baseVars);
  const reLogin = await request("/api/admin/auth/login", { method: "POST", headers: { ...sameOrigin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  check(reLogin.ok && (await json(reLogin)).ok === true, "admin hash persists after restart without the initialization secret");
  await stop();

  await start({ ...baseVars, SITE_ADMIN_ENABLED: "false" });
  check((await request("/admin")).status === 404 && (await request("/api/admin/entries")).status === 404, "disabled hosted admin fails closed");
} catch {
  assertions.push({ label: "isolated hosted HTTP verification completed", passed: false });
} finally {
  try { await stop(); } catch { assertions.push({ label: "isolated process tree stopped and port released", passed: false }); if (child) { try { await killTree(child); } catch { /* retain failure in the safe result */ } } }
  password = "";
  try { await rm(qaConfig, { force: true }); } catch { assertions.push({ label: "temporary QA config cleanup", passed: false }); }
  const result = { assertions, counts: { assertions: assertions.length, passed: assertions.filter(item => item.passed).length, failed: assertions.filter(item => !item.passed).length } };
  await mkdir(qaDir, { recursive: true });
  await writeFile(path.join(qaDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ assertions: assertions.length, passed: assertions.filter(item => item.passed).length, failed: assertions.filter(item => !item.passed).length }));
if (assertions.some(item => !item.passed)) process.exitCode = 1;
