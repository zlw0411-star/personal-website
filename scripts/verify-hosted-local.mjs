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
const assertions = [], verifyProgress = [];
let child = null, password = `Hosted-QA-${randomUUID()}-fixture`;
let phase = "startup";
let authStatusDiagnostic = null;
let loginWindow = null;
let workerEvents = [];
const verifyAdminLabels = new Set([
  "admin auth status exposes configuration without authenticating",
  "anonymous management access is denied before data is read",
  "unauthorized write is rejected before parsing request body",
  "forged admin cookie is rejected",
  "login rejects missing Origin",
  "login rejects cross-site fetch metadata",
  "admin login status is successful",
  "admin login response confirms success",
  "admin login cookie format is valid",
  "admin login cookie uses secure attributes",
  "correct password creates a strict HttpOnly 12-hour admin session",
  "admin auth status confirms the independent session",
  "authenticated writes still require exact same-origin",
  "authenticated admin can upload a fixture image",
  "authenticated admin can create a private fixture entry",
  "authenticated admin can list entries",
  "admin entry list omits rich-text body payloads",
  "authenticated admin entry detail still includes the full body",
  "authenticated admin can update its fixture entry",
  "authenticated admin can read its uploaded fixture media",
  "admin media HEAD uses the same authenticated gate",
  "authenticated admin can delete its fixture entry",
  "authenticated admin can delete its unreferenced fixture media",
  "logout revokes and clears the admin session",
  "revoked admin cookie cannot be replayed",
  "life category creation is rejected",
  "rejected life content was not stored",
  "private fixture detail and media are hidden",
  "public fixture detail and media are available",
  "published private fixture detail and media are hidden",
  "fixture can be published as public",
  "fixture can be changed to published private",
]);
const derive = promisify(scryptCallback), hashOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function codedError(code, details = {}) { const error = new Error(); error.qaCode = code; Object.assign(error, details); return error; }
function safeCode(error) {
  if (/^[A-Z0-9_]+$/.test(error?.qaCode ?? "")) return error.qaCode;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "REQUEST_TIMEOUT";
  if (/^[A-Z0-9_]+$/.test(error?.code ?? "")) return error.code;
  return "UNCLASSIFIED_ERROR";
}
function check(ok, label, status) {
  const assertion = { label, passed: Boolean(ok), ...(!ok ? { code: "ASSERTION_FAILED" } : {}), ...(Number.isInteger(status) ? { status } : {}) };
  assertions.push(assertion);
  if (!ok) throw codedError("ASSERTION_FAILED", { qaLabel: label, ...(Number.isInteger(status) ? { status } : {}) });
}
async function freePort() {
  const code = await new Promise(resolve => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const timer = setTimeout(() => { socket.destroy(); resolve("timeout"); }, 700);
    socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolve("open"); });
    socket.once("error", error => { clearTimeout(timer); resolve(error.code); });
  });
  if (code !== "ECONNREFUSED") throw codedError("ISOLATED_PORT_UNAVAILABLE");
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
    proc.once("error", error => { clearTimeout(timer); resolve({ error: true, errorCode: /^[A-Z0-9_]+$/.test(error?.code ?? "") ? error.code : "UNCLASSIFIED_ERROR" }); });
  });
}
async function killTree(proc) {
  if (proc.exitCode !== null || proc.signalCode !== null) return { status: "already-exited" };
  if (process.platform === "win32") {
    if (proc.stdin?.writable) proc.stdin.end("STOP\n");
    const graceful = await waitExit(proc, 15_000);
    if (!graceful.timeout) return { status: "stopped" };
    for (let attempt = 0; attempt < 2 && proc.exitCode === null && proc.signalCode === null; attempt++) {
      const killer = spawn("taskkill.exe", ["/PID", String(proc.pid), "/T", "/F"], { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
      const killResult = await waitExit(killer, 5000);
      const exitResult = await waitExit(proc, 5000);
      if (exitResult.timeout && attempt === 1) {
        let alive = true;
        try { process.kill(proc.pid, 0); } catch (error) { if (error?.code === "ESRCH") alive = false; }
        if (alive) throw codedError("OWNED_PROCESS_TREE_TIMEOUT", { exitCode: killResult.code });
      }
    }
  } else {
    proc.kill("SIGTERM");
    const termResult = await waitExit(proc, 3000);
    if (termResult.timeout) { proc.kill("SIGKILL"); await waitExit(proc, 3000); }
  }
  if (proc.exitCode === null && proc.signalCode === null) {
    let alive = true;
    try { process.kill(proc.pid, 0); } catch (error) { if (error?.code === "ESRCH") alive = false; }
    if (alive) throw codedError("OWNED_PROCESS_TREE_TIMEOUT");
  }
  return { status: "stopped" };
}
async function runCli(args, input = "", timeoutMs = 90_000, extraEnv = {}, stage = "bounded-child") {
  const proc = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: safeEnv(extraEnv) });
  const outputBuffers = { stdout: "", stderr: "" };
  const captureSafeTags = (chunk, source) => {
    if (stage !== "admin-crud-and-media") return;
    outputBuffers[source] = (outputBuffers[source] + chunk.toString("utf8")).slice(-8192);
    const lines = outputBuffers[source].split(/\r?\n/u);
    outputBuffers[source] = lines.pop() ?? "";
    for (const line of lines) {
      const match = source === "stdout" ? line.match(/^\[VERIFY PASS\] (.{1,180})$/u) : null;
      if (match && verifyAdminLabels.has(match[1])) verifyProgress.push({ label: match[1], status: "PASS" });
      const failure = line.match(/^\[VERIFY FAIL\] phase=([a-z0-9-]+) code=([A-Z0-9_]+)(?: status=(\d{3}))?(?: exitCode=(-?\d+))?(?: label=(.{1,180}))?$/u);
      if (failure) verifyProgress.push({ label: verifyAdminLabels.has(failure[5]) ? failure[5] : failure[1], status: "FAIL", code: failure[2], ...(failure[3] ? { httpStatus: Number(failure[3]) } : {}), ...(failure[4] ? { exitCode: Number(failure[4]) } : {}) });
    }
  };
  proc.stdout.on("data", chunk => captureSafeTags(chunk, "stdout"));
  proc.stderr.on("data", chunk => captureSafeTags(chunk, "stderr"));
  proc.stdin.end(input);
  const result = await waitExit(proc, timeoutMs);
  if (result.timeout) { await killTree(proc); throw codedError(`${stage.toUpperCase().replaceAll("-", "_")}_TIMEOUT`); }
  if (result.error) throw codedError(`${stage.toUpperCase().replaceAll("-", "_")}_SPAWN_FAILED`, { errorCode: result.errorCode });
  if (result.code !== 0) throw codedError(`${stage.toUpperCase().replaceAll("-", "_")}_FAILED`, { exitCode: result.code });
}
async function stop() {
  if (!child) return;
  const proc = child;
  await killTree(proc);
  try { await freePort(); } catch { throw codedError("ISOLATED_PORT_STILL_OCCUPIED"); }
  child = null;
}
async function start(vars, migrate = false) {
  await freePort();
  await writeConfig(vars);
  if (migrate) await runCli([path.join(root, "node_modules", "wrangler", "bin", "wrangler.js"), "d1", "migrations", "apply", "DB", "--local", "--config", qaConfig, "--persist-to", stateDir], "", 90_000, {}, "isolated-migration");
  child = spawn(process.execPath, [path.join(root, "scripts", "qa-worker.mjs"), qaConfig, stateDir, String(port), path.join(qaDir, "registry")], {
    cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
    env: safeEnv(),
  });
  let wrapperReady = false, stdoutBuffer = "";
  child.stdout.on("data", chunk => {
    stdoutBuffer = (stdoutBuffer + chunk.toString("utf8")).slice(-1024);
    const lines = stdoutBuffer.split(/\r?\n/u);
    stdoutBuffer = lines.pop() ?? "";
    if (lines.includes("[QA_WORKER_READY]")) wrapperReady = true;
  });
  child.stderr.resume();
  const deadline = Date.now() + 90_000;
  let homeResponds = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw codedError("WRANGLER_EXITED_BEFORE_READY", { exitCode: child.exitCode });
    try {
      const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(Math.min(15_000, deadline - Date.now())) });
      await response.arrayBuffer();
      if (response.ok) homeResponds = true;
    } catch { /* keep polling until the bounded ready deadline */ }
    if (wrapperReady && homeResponds) return;
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  throw codedError("WRANGLER_READY_TIMEOUT");
}
async function runAdminCrud() {
  await runCli([path.join(root, "scripts", "verify-admin.mjs")], `${password}\n`, 90_000, { BASE_URL: origin }, "admin-crud-and-media");
}
async function request(route, options = {}) {
  const response = await fetch(`${origin}${route}`, { ...options, signal: AbortSignal.timeout(15_000) });
  const body = await response.arrayBuffer();
  return new Response(body.byteLength ? body : null, { status: response.status, statusText: response.statusText, headers: response.headers });
}
const json = response => response.json().catch(() => ({}));
const sameOrigin = { Origin: origin, "Sec-Fetch-Site": "same-origin" };

try {
  phase = "isolated-setup";
  await freePort();
  await mkdir(stateDir, { recursive: true }); await mkdir(cfHome, { recursive: true });
  const adminSeed = await seed();
  const initial = JSON.stringify({ admin: adminSeed });
  const baseVars = { SITE_ADMIN_ENABLED: "true", SITE_ORIGIN: origin };

  phase = "isolated-migration-and-start";
  await start({ ...baseVars, SITE_INITIAL_SECURITY: initial }, true);
  phase = "public-and-admin-route-checks";
  const home = await request("/"); const homeHtml = await home.text();
  check(home.ok && homeHtml.includes('href="/admin"') && homeHtml.includes("管理内容"), "public page always exposes the admin link");
  const adminPage = await request("/admin"); const adminHtml = await adminPage.text();
  check(adminPage.ok && adminHtml.includes("管理员登录"), "hosted admin route renders its login page");
  check((await request("/api/admin/entries")).status === 401, "anonymous admin API access requires login");
  check((await request("/api/entries?category=life", { headers: { Cookie: "life_session=legacy" } })).status === 404, "disabled life listing remains unavailable with a legacy cookie");
  for (const route of ["/api/life/status", "/api/life/unlock", "/api/life/lock", "/admin/privacy", "/api/admin/life-password"]) {
    const response = await request(route);
    check(response.status === 404, `disabled life route ${route} is unavailable`, response.status);
  }

  phase = "same-origin-and-admin-login";
  phase = "pre-login-admin-auth-status";
  const preLoginStatus = await request("/api/admin/auth/status");
  const preLoginBody = await json(preLoginStatus);
  authStatusDiagnostic = { httpStatus: preLoginStatus.status, configured: preLoginBody.configured === true, authenticated: preLoginBody.authenticated === true };
  const isConfigured = preLoginStatus.status === 200 && preLoginBody.configured === true;
  check(isConfigured, "admin auth status confirms configured admin", preLoginStatus.status);

  phase = "same-origin-and-admin-login";
  const wrongOrigin = await request("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://invalid.example", "Sec-Fetch-Site": "cross-site" }, body: JSON.stringify({ password }) });
  check(wrongOrigin.status === 403, "admin login rejects a non-matching origin");
  loginWindow = { startedAt: new Date().toISOString() };
  const login = await request("/api/admin/auth/login", { method: "POST", headers: { ...sameOrigin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  loginWindow.finishedAt = new Date().toISOString();
  loginWindow.httpStatus = login.status;
  const loginBody = await json(login);
  const loginCookie = login.headers.get("set-cookie") ?? "";
  const adminCookie = loginCookie.split(";")[0];
  check(login.ok, "admin login status is successful", login.status);
  check(loginBody.ok === true, "admin login response confirms success", login.status);
  check(/^admin_session=[0-9a-f]{64}$/i.test(adminCookie), "admin login cookie format is valid", login.status);
  check(/httponly/i.test(loginCookie) && /samesite=strict/i.test(loginCookie) && /path=\//i.test(loginCookie) && /max-age=43200/i.test(loginCookie), "admin login cookie uses secure attributes", login.status);
  phase = "admin-crud-and-media";
  try { await runAdminCrud(); check(true, "isolated admin CRUD and media verification passed"); }
  catch (error) { assertions.push({ label: "isolated admin CRUD and media verification", passed: false, code: safeCode(error), ...(/^[A-Z0-9_]+$/.test(error?.errorCode ?? "") ? { childErrorCode: error.errorCode } : {}), ...(Number.isInteger(error?.exitCode) ? { exitCode: error.exitCode } : {}) }); throw error; }

  phase = "admin-restart-persistence";
  await stop();
  await start(baseVars);
  const reLogin = await request("/api/admin/auth/login", { method: "POST", headers: { ...sameOrigin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  check(reLogin.ok && (await json(reLogin)).ok === true, "admin hash persists after restart without the initialization secret");
  phase = "admin-disabled-gate";
  await stop();

  await start({ ...baseVars, SITE_ADMIN_ENABLED: "false" });
  check((await request("/admin")).status === 404 && (await request("/api/admin/entries")).status === 404, "disabled hosted admin fails closed");
} catch (error) {
  if (!assertions.some(item => !item.passed)) assertions.push({ label: `stage ${phase}`, passed: false, code: safeCode(error), ...(Number.isInteger(error?.status) ? { status: error.status } : {}), ...(Number.isInteger(error?.exitCode) ? { exitCode: error.exitCode } : {}) });
} finally {
  phase = "cleanup-owned-wrangler-process-tree";
  try { await stop(); } catch (error) { assertions.push({ label: "owned Wrangler process tree cleanup", passed: false, code: safeCode(error), ...(Number.isInteger(error?.exitCode) ? { exitCode: error.exitCode } : {}) }); }
  password = "";
  try { await rm(qaConfig, { force: true }); } catch (error) { assertions.push({ label: "temporary QA config cleanup", passed: false, code: safeCode(error) }); }
  const result = { assertions, counts: { assertions: assertions.length, passed: assertions.filter(item => item.passed).length, failed: assertions.filter(item => !item.passed).length } };
  await mkdir(qaDir, { recursive: true });
  result.verifyAdminProgress = verifyProgress;
  result.authStatusDiagnostic = authStatusDiagnostic;
  result.loginWindow = loginWindow;
  try {
    workerEvents = (await readFile(path.join(qaDir, "worker-events.jsonl"), "utf8")).trim().split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
  } catch { workerEvents = []; }
  result.workerEvents = workerEvents;
  await writeFile(path.join(qaDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ assertions: assertions.length, passed: assertions.filter(item => item.passed).length, failed: assertions.filter(item => !item.passed).length, failures: assertions.filter(item => !item.passed), verifyAdminProgress: verifyProgress, authStatusDiagnostic, loginWindow, workerEvents }));
if (assertions.some(item => !item.passed)) process.exitCode = 1;
