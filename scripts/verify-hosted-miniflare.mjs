import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const id = randomUUID();
const qaDir = path.join(root, ".sites-runtime", `hosted-miniflare-${id}`);
const stateDir = path.join(qaDir, "state"), cfHome = path.join(qaDir, "cf-home");
const configPath = path.join(root, "dist", "server", `wrangler.miniflare-qa-${id}.json`);
const resultPath = path.join(qaDir, "result.json");
const reportPath = path.join(qaDir, "REPORT.md");
const derive = promisify(scryptCallback), options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
let mf;
let worker;
let Miniflare, unstable_getMiniflareWorkerOptions;
let phase = "setup";
let bridgeOrigin = "";
let activeWorker;
const bridgeErrorCodes = [];
const bridge = createServer(async (incoming, outgoing) => {
  let stage = "request-body";
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const method = incoming.method ?? "GET";
    const body = chunks.length && method !== "GET" && method !== "HEAD" ? Buffer.concat(chunks) : undefined;
    stage = "request-construction";
    const requestUrl = new URL(incoming.url ?? "/", bridgeOrigin).href;
    const requestHeaders = new Headers(incoming.headers);
    stage = "worker-fetch";
    const response = await activeWorker.fetch(requestUrl, { method, headers: requestHeaders, ...(body ? { body, duplex: "half" } : {}) });
    stage = "response-write";
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (method === "HEAD") outgoing.end();
    else outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    const code = /^[A-Z0-9_]+$/u.test(error?.code ?? "") ? error.code : /^[A-Za-z]+Error$/u.test(error?.name ?? "") ? error.name : "OTHER";
    bridgeErrorCodes.push(`${stage}:${code}`);
    outgoing.writeHead(500, { "content-type": "text/plain" });
    outgoing.end("isolated direct worker request failed");
  }
});

async function runAdminCrud(password) {
  const baseUrl = bridgeOrigin;
  const bridgeStatus = await fetch(`${baseUrl}/api/admin/auth/status`);
  const bridgeStatusBody = await bridgeStatus.json().catch(() => ({}));
  const child = spawn(process.execPath, [path.join(root, "scripts", "verify-admin.mjs")], { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, BASE_URL: baseUrl } });
  const labels = [], failures = [], buffers = { stdout: "", stderr: "" };
  const capture = (chunk, stream) => {
    buffers[stream] = (buffers[stream] + chunk.toString("utf8")).slice(-8192);
    const lines = buffers[stream].split(/\r?\n/u);
    buffers[stream] = lines.pop() ?? "";
    for (const line of lines) {
      const pass = line.match(/^\[VERIFY PASS\] (.{1,180})$/u);
      if (stream === "stdout" && pass) labels.push(pass[1]);
      const fail = line.match(/^\[VERIFY FAIL\] phase=([a-z0-9-]+) code=([A-Z0-9_]+)(?: status=(\d{3}))?(?: exitCode=(-?\d+))?(?: label=(.{1,180}))?$/u);
      if (fail) failures.push({ phase: fail[1], code: fail[2], ...(fail[3] ? { status: Number(fail[3]) } : {}), ...(fail[4] ? { exitCode: Number(fail[4]) } : {}), ...(fail[5] ? { label: fail[5] } : {}) });
    }
  };
  child.stdout.on("data", chunk => capture(chunk, "stdout"));
  child.stderr.on("data", chunk => capture(chunk, "stderr"));
  child.stdin.end(`${password}\n`);
  const code = await new Promise(resolve => {
    const timeout = setTimeout(() => { child.kill(); resolve("timeout"); }, 90_000);
    child.once("exit", value => { clearTimeout(timeout); resolve(value); });
    child.once("error", () => { clearTimeout(timeout); resolve("spawn-error"); });
  });
  for (const stream of ["stdout", "stderr"]) if (buffers[stream]) capture(Buffer.from("\n"), stream);
  return { bridgeStatus: bridgeStatus.status, configured: bridgeStatusBody.configured === true, bridgeErrorCodes, exitCode: code, assertionsPassed: labels.length, labels, failures };
}

async function makeWorker(configPath, stateDir) {
  const generated = unstable_getMiniflareWorkerOptions(configPath);
  const serverRoot = path.dirname(generated.main);
  const modules = [];
  const visitModules = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visitModules(file);
      else if (/\.(?:js|mjs)$/u.test(entry.name)) modules.push({ type: "ESModule", path: file });
    }
  };
  await visitModules(serverRoot);
  const runtime = new Miniflare({ ...generated.workerOptions, modules, modulesRoot: serverRoot, d1Persist: stateDir, r2Persist: stateDir });
  return { runtime, worker: await runtime.getWorker() };
}

async function workerRequest(workerInstance, route, options = {}) {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  if (options.write) { headers.set("Origin", bridgeOrigin); headers.set("Sec-Fetch-Site", "same-origin"); }
  if (options.cookie) headers.set("Cookie", options.cookie);
  return fetch(new URL(route, bridgeOrigin).href, { ...options, method, headers, signal: options.signal ?? AbortSignal.timeout(15_000) });
}

function record(assertions, ok, label, status) {
  assertions.push({ label, passed: Boolean(ok), ...(Number.isInteger(status) ? { status } : {}), ...(!ok ? { code: "ASSERTION_FAILED" } : {}) });
  if (!ok) throw Object.assign(new Error(), { qaResult: { mode: "direct-miniflare-built-worker", phase, assertions } });
}

async function verifyRestartPersistence(password) {
  const assertions = [];
  const initialResponse = await workerRequest(worker, "/api/profile");
  const initialBody = await initialResponse.json().catch(() => ({}));
  const originalProfile = initialBody.profile;
  record(assertions, initialResponse.status === 200 && originalProfile?.siteName, "isolated profile baseline is readable", initialResponse.status);

  const login = await workerRequest(worker, "/api/admin/auth/login", { method: "POST", write: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  const loginBody = await login.json().catch(() => ({}));
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  record(assertions, login.status === 200 && loginBody.ok === true && /^admin_session=[0-9a-f]{64}$/iu.test(cookie), "direct worker creates an independent admin session", login.status);

  const profileFixture = { ...originalProfile, siteName: "Hosted QA Fixture", nickname: "Isolated QA", bio: "Temporary isolated profile.", about: "Restart persistence fixture.", experience: "Temporary fixture record.", email: "qa@example.test", contacts: [{ kind: "text", label: "QA", value: "isolated" }] };
  const profileWrite = await workerRequest(worker, "/api/admin/profile", { method: "PUT", write: true, cookie, headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileFixture) });
  record(assertions, profileWrite.ok, "authenticated admin can save an isolated profile fixture", profileWrite.status);

  const imageBytes = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V7sAAAAASUVORK5CYII=", "base64"));
  const form = new FormData(); form.set("file", new File([imageBytes], "hosted-qa.png", { type: "image/png" }));
  const uploaded = await workerRequest(worker, "/api/admin/media", { method: "POST", write: true, cookie, body: form });
  const uploadBody = await uploaded.json().catch(() => ({}));
  const mediaId = uploadBody.id;
  record(assertions, uploaded.ok && typeof mediaId === "string", "authenticated admin can upload a restart fixture image", uploaded.status);

  const entryTitle = `[hosted-miniflare:${randomUUID()}] persistence fixture`;
  const payload = { category: "learning", status: "draft", visibility: "private", title: entryTitle, summary: "Isolated restart fixture.", projectUrl: "", repositoryUrl: "", coverId: mediaId, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Isolated fixture body." }] }] } };
  const created = await workerRequest(worker, "/api/admin/entries", { method: "POST", write: true, cookie, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const createdBody = await created.json().catch(() => ({}));
  const entryId = createdBody.entry?.id;
  record(assertions, created.status === 201 && typeof entryId === "string", "authenticated admin can create a private restart fixture article", created.status);
  record(assertions, (await workerRequest(worker, `/api/entries/${entryId}`)).status === 404 && (await workerRequest(worker, `/api/media/${mediaId}`)).status === 404, "private restart fixture article and media stay hidden before restart");

  const draftPublic = await workerRequest(worker, `/api/admin/entries/${entryId}`, { method: "PUT", write: true, cookie, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, visibility: "public" }) });
  const publicDraftListResponse = await workerRequest(worker, "/api/entries?category=learning");
  const publicDraftList = await publicDraftListResponse.json().catch(() => ({}));
  record(assertions, draftPublic.ok && publicDraftListResponse.status === 200 && Array.isArray(publicDraftList.entries) && (await workerRequest(worker, `/api/entries/${entryId}`)).status === 404 && (await workerRequest(worker, `/api/media/${mediaId}`)).status === 404 && !publicDraftList.entries.some(entry => entry.id === entryId), "draft public article and media remain hidden from detail, media, and public list", publicDraftListResponse.status);
  const restoreDraftPrivate = await workerRequest(worker, `/api/admin/entries/${entryId}`, { method: "PUT", write: true, cookie, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  record(assertions, restoreDraftPrivate.ok, "draft fixture visibility is restored before restart", restoreDraftPrivate.status);

  const config = JSON.parse(await readFile(configPath, "utf8"));
  delete config.vars.SITE_INITIAL_SECURITY;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await mf.dispose(); mf = undefined;
  ({ runtime: mf, worker } = await makeWorker(configPath, stateDir)); activeWorker = worker;
  const reLogin = await workerRequest(worker, "/api/admin/auth/login", { method: "POST", write: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  const reLoginBody = await reLogin.json().catch(() => ({}));
  const restartedCookie = (reLogin.headers.get("set-cookie") ?? "").split(";")[0];
  record(assertions, reLogin.status === 200 && reLoginBody.ok === true && /^admin_session=[0-9a-f]{64}$/iu.test(restartedCookie), "admin hash persists after direct worker restart", reLogin.status);
  const publicProfile = await workerRequest(worker, "/api/profile");
  const publicProfileBody = await publicProfile.json().catch(() => ({}));
  record(assertions, publicProfile.ok && publicProfileBody.profile?.nickname === profileFixture.nickname && publicProfileBody.profile?.contacts?.[0]?.value === "isolated", "profile and contacts persist after restart", publicProfile.status);
  const adminListResponse = await workerRequest(worker, "/api/admin/entries", { cookie: restartedCookie });
  const adminList = await adminListResponse.json().catch(() => ({}));
  record(assertions, adminListResponse.ok && adminList.entries?.some(entry => entry.id === entryId), "private article persists after restart", adminListResponse.status);
  const adminDetailResponse = await workerRequest(worker, `/api/admin/entries/${entryId}`, { cookie: restartedCookie });
  const adminDetailBody = await adminDetailResponse.json().catch(() => ({}));
  const persistedEntry = adminDetailBody.entry;
  record(assertions, adminDetailResponse.ok && persistedEntry?.id === entryId && persistedEntry.title === entryTitle && persistedEntry.body?.type === "doc" && persistedEntry.body?.content?.[0]?.content?.[0]?.text === "Isolated fixture body." && persistedEntry.coverId === mediaId && persistedEntry.status === "draft" && persistedEntry.visibility === "private", "article title, body, cover, status, and visibility persist after restart", adminDetailResponse.status);
  const adminImage = await workerRequest(worker, `/api/admin/media/${mediaId}`, { cookie: restartedCookie });
  const image = new Uint8Array(await adminImage.arrayBuffer());
  record(assertions, adminImage.ok && image.length === imageBytes.length && image.every((byte, index) => byte === imageBytes[index]), "private image bytes persist in isolated R2 after restart", adminImage.status);
  record(assertions, (await workerRequest(worker, `/api/entries/${entryId}`)).status === 404 && (await workerRequest(worker, `/api/media/${mediaId}`)).status === 404, "private article and media remain hidden after restart");

  const published = { ...payload, status: "published", visibility: "public" };
  const publishResponse = await workerRequest(worker, `/api/admin/entries/${entryId}`, { method: "PUT", write: true, cookie: restartedCookie, headers: { "Content-Type": "application/json" }, body: JSON.stringify(published) });
  record(assertions, publishResponse.ok, "persisted article can be published after restart", publishResponse.status);
  record(assertions, (await workerRequest(worker, `/api/entries/${entryId}`)).status === 200 && (await workerRequest(worker, `/api/media/${mediaId}`)).status === 200, "public article and media become available after restart");
  const privateResponse = await workerRequest(worker, `/api/admin/entries/${entryId}`, { method: "PUT", write: true, cookie: restartedCookie, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...published, visibility: "private" }) });
  record(assertions, privateResponse.ok, "persisted article can return to private after restart", privateResponse.status);
  record(assertions, (await workerRequest(worker, `/api/entries/${entryId}`)).status === 404 && (await workerRequest(worker, `/api/media/${mediaId}`)).status === 404, "published private article and media are hidden after restart");

  const removedEntry = await workerRequest(worker, `/api/admin/entries/${entryId}`, { method: "DELETE", write: true, cookie: restartedCookie });
  record(assertions, removedEntry.ok, "isolated restart article fixture is cleaned up", removedEntry.status);
  const removedMedia = await workerRequest(worker, `/api/admin/media/${mediaId}`, { method: "DELETE", write: true, cookie: restartedCookie });
  record(assertions, removedMedia.ok, "isolated restart media fixture is cleaned up", removedMedia.status);
  const restoreProfile = await workerRequest(worker, "/api/admin/profile", { method: "PUT", write: true, cookie: restartedCookie, headers: { "Content-Type": "application/json" }, body: JSON.stringify(originalProfile) });
  record(assertions, restoreProfile.ok, "isolated profile fixture is restored", restoreProfile.status);
  const logout = await workerRequest(worker, "/api/admin/auth/logout", { method: "POST", write: true, cookie: restartedCookie });
  const replay = await workerRequest(worker, "/api/admin/entries", { cookie: restartedCookie });
  record(assertions, logout.ok && replay.status === 401, "logout revokes the restarted worker session");
  return assertions;
}

async function verifyLockout(password) {
  phase = "wrong-password-lockout";
  const assertions = [];
  const wrong = `${password}-wrong`;
  const responses = [];
  for (let index = 0; index < 5; index++) responses.push(await workerRequest(worker, "/api/admin/auth/login", { method: "POST", write: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: wrong }) }));
  record(assertions, responses.every(response => response.status === 401), "wrong admin password is rejected without revealing account state", responses[0]?.status);
  const locked = await workerRequest(worker, "/api/admin/auth/login", { method: "POST", write: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: wrong }) });
  const retryAfter = Number(locked.headers.get("retry-after"));
  record(assertions, locked.status === 429 && Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 60, "repeated wrong passwords activate a bounded login lockout", locked.status);
  return assertions;
}

try {
  await mkdir(stateDir, { recursive: true });
  await mkdir(cfHome, { recursive: true });
  const safeKeys = new Set(["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP"]);
  for (const key of Object.keys(process.env)) if (!safeKeys.has(key)) delete process.env[key];
  process.env.USERPROFILE = cfHome;
  process.env.APPDATA = cfHome;
  process.env.LOCALAPPDATA = cfHome;
  process.env.CLOUDFLARE_HOME = cfHome;
  process.env.CI = "1";
  process.env.WRANGLER_SEND_METRICS = "false";
  await new Promise((resolve, reject) => { bridge.once("error", reject); bridge.listen(0, "127.0.0.1", resolve); });
  bridgeOrigin = `http://127.0.0.1:${bridge.address().port}`;
  const password = `Direct-QA-${randomUUID()}-fixture`;
  const salt = randomBytes(16);
  const admin = { algorithm: "scrypt-N32768-r8-p3-v1", salt: salt.toString("hex"), passwordHash: (await derive(password, salt, 32, options)).toString("hex"), version: randomUUID() };
  const config = JSON.parse(await readFile(path.join(root, "dist", "server", "wrangler.json"), "utf8"));
  config.vars = { ...(config.vars ?? {}), SITE_ADMIN_ENABLED: "true", SITE_ORIGIN: bridgeOrigin, SITE_INITIAL_SECURITY: JSON.stringify({ admin }) };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  ({ unstable_getMiniflareWorkerOptions } = await import("wrangler"));
  ({ Miniflare } = await import("miniflare"));
  ({ runtime: mf, worker } = await makeWorker(configPath, stateDir));
  activeWorker = worker;
  const migrations = path.join(root, "drizzle");
  const names = (await readdir(migrations)).filter(name => /^\d{4}_.*\.sql$/u.test(name)).sort();
  phase = "migrations";
  const db = await mf.getD1Database("DB");
  for (const name of names) {
    const sql = (await readFile(path.join(migrations, name), "utf8")).replace(/--> statement-breakpoint/gu, "");
    for (const statement of sql.split(";").map(item => item.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  phase = "auth-status";
  const status = await worker.fetch(`${bridgeOrigin}/api/admin/auth/status`);
  phase = "origin-check";
  const wrongOrigin = await worker.fetch(`${bridgeOrigin}/api/admin/auth/login`, { method: "POST", headers: { Origin: "https://invalid.example", "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  phase = "login";
  const login = await worker.fetch(`${bridgeOrigin}/api/admin/auth/login`, { method: "POST", headers: { Origin: bridgeOrigin, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  const statusBody = await status.json().catch(() => ({}));
  const wrongOriginBody = await wrongOrigin.json().catch(() => ({}));
  const loginBody = await login.json().catch(() => ({}));
  const setCookie = login.headers.get("set-cookie") ?? "";
  if (status.status !== 200 || statusBody.configured !== true || statusBody.authenticated !== false) throw Object.assign(new Error(), { qaResult: { mode: "direct-miniflare-built-worker", phase: "auth-status", status: status.status } });
  if (wrongOrigin.status !== 403) throw Object.assign(new Error(), { qaResult: { mode: "direct-miniflare-built-worker", phase: "wrong-origin", status: wrongOrigin.status, error: typeof wrongOriginBody.error === "string" ? "safe-error-present" : "none" } });
  if (login.status !== 200 || loginBody.ok !== true || !/^admin_session=[0-9a-f]{64}/iu.test(setCookie) || !/httponly/iu.test(setCookie) || !/samesite=strict/iu.test(setCookie) || !/max-age=43200/iu.test(setCookie)) throw Object.assign(new Error(), { qaResult: { mode: "direct-miniflare-built-worker", phase: "login-contract", status: login.status } });
  phase = "admin-crud";
  const directCrud = await runAdminCrud(password);
  const result = { mode: "direct-miniflare-built-worker", authStatus: status.status, wrongOriginStatus: wrongOrigin.status, loginStatus: login.status, directCrud };
  const expectedLabels = [
    "admin auth status exposes configuration without authenticating", "anonymous management access is denied before data is read", "unauthorized write is rejected before parsing request body", "forged admin cookie is rejected", "login rejects missing Origin", "login rejects cross-site fetch metadata", "correct password creates a strict HttpOnly 12-hour admin session", "admin auth status confirms the independent session", "authenticated writes still require exact same-origin", "authenticated admin can upload a fixture image", "authenticated admin can create a private fixture entry", "life category creation is rejected", "rejected life content was not stored", "private fixture detail and media are hidden", "fixture can be published as public", "public fixture detail and media are available", "fixture can be changed to published private", "published private fixture detail and media are hidden", "authenticated admin can list entries", "admin entry list omits rich-text body payloads", "authenticated admin entry detail still includes the full body", "authenticated admin can update its fixture entry", "authenticated admin can read its uploaded fixture media", "admin media HEAD uses the same authenticated gate", "authenticated admin can delete its fixture entry", "authenticated admin can delete its unreferenced fixture media", "logout revokes and clears the admin session", "revoked admin cookie cannot be replayed",
  ];
  if (directCrud.exitCode !== 0 || directCrud.assertionsPassed !== expectedLabels.length || expectedLabels.some(label => !directCrud.labels.includes(label))) throw Object.assign(new Error(), { qaResult: result });
  phase = "restart-persistence";
  const persistenceAssertions = await verifyRestartPersistence(password);
  const lockoutAssertions = await verifyLockout(password);
  result.persistenceAssertions = persistenceAssertions;
  result.lockoutAssertions = lockoutAssertions;
  result.assertionCount = directCrud.assertionsPassed + persistenceAssertions.length + lockoutAssertions.length + 3;
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  await writeFile(reportPath, `# Isolated hosted runtime QA\n\n- Result: PASS (${result.assertionCount}/${result.assertionCount})\n- Runtime: production build loaded directly by Miniflare, with isolated D1/R2 and assets\n- Coverage: admin auth and same-origin checks; 28 CRUD/media/security assertions; profile/article/image persistence across worker restart; public/private visibility; logout replay; wrong-password lockout\n- Data: generated fixtures were deleted or restored; state is isolated under \`${stateDir}\`\n- Wrangler comparison: see the separate hosted-local QA report. Its proxy returned HTTP 503 and reported a worker restart during login; the triggering cause is not established.\n`, { mode: 0o600 });
  console.log(JSON.stringify(result));
} catch (error) {
  if (error?.qaResult) {
    await mkdir(qaDir, { recursive: true });
    await writeFile(resultPath, `${JSON.stringify(error.qaResult, null, 2)}\n`, { mode: 0o600 });
    await writeFile(reportPath, `# Isolated hosted runtime QA\n\n- Result: FAIL during ${phase}\n- Diagnostic: see \`result.json\` for safe status-only assertions\n- Isolated state: \`${stateDir}\`\n`, { mode: 0o600 });
    console.log(JSON.stringify(error.qaResult));
    process.exitCode = 1;
  } else {
  const code = /^[A-Z0-9_]+$/u.test(error?.code ?? "") ? error.code : error?.name === "TimeoutError" ? "TIMEOUT" : "UNCLASSIFIED_ERROR";
  const issueSet = error?.issues ?? error?.cause?.issues ?? error?.cause?.errors;
  const fields = Array.isArray(issueSet) ? issueSet.slice(0, 20).map(issue => (issue.path ?? []).map(part => /^[A-Za-z0-9_]+$/u.test(String(part)) ? String(part) : "index").join(".")) : [];
  const result = { mode: "direct-miniflare-built-worker", phase, errorCode: code, errorName: /^[A-Za-z]+Error$/u.test(error?.name ?? "") ? error.name : "OTHER", fields };
  await mkdir(qaDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  await writeFile(reportPath, `# Isolated hosted runtime QA\n\n- Result: FAIL during ${phase} (${code})\n- Isolated state: \`${stateDir}\`\n`, { mode: 0o600 });
  console.log(JSON.stringify(result));
  process.exitCode = 1;
  }
} finally {
  if (bridge.listening) await new Promise(resolve => bridge.close(resolve));
  try { if (mf) await mf.dispose(); }
  finally { try { await (await import("node:fs/promises")).rm(configPath, { force: true }); } catch { /* only remove the unique temporary config */ } }
}
