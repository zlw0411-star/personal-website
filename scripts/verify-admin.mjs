import { randomUUID } from "node:crypto";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5173");
if (!/^https?:$/.test(base.protocol) || base.username || base.password || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(base.hostname)) throw new Error("BASE_URL 仅支持无凭据的 loopback 地址");
const runId = randomUUID(), titlePrefix = `[verify-admin:${runId}]`;
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V7sAAAAASUVORK5CYII=", "base64"));
const entries = new Set(), mediaIds = new Set(), failures = [];
let adminCookie = null, passwordInput = "";
let phase = "startup";
for await (const chunk of process.stdin) { passwordInput += chunk.toString(); if (Buffer.byteLength(passwordInput, "utf8") > 1024) throw new Error("密码输入过长"); }
let password = passwordInput.replace(/\r?\n$/, ""); passwordInput = "";
if (password.length < 8 || password.length > 256) throw new Error("请通过 stdin 提供 8 至 256 位管理密码。");

async function request(route, options = {}) {
  const headers = new Headers(options.headers);
  if (options.write) { headers.set("Origin", base.origin); headers.set("Sec-Fetch-Site", "same-origin"); }
  if (options.cookie) headers.set("Cookie", options.cookie);
  else if (adminCookie && options.withAdmin !== false) headers.set("Cookie", adminCookie);
  const response = await fetch(new URL(route, base), { ...options, headers, signal: options.signal ?? AbortSignal.timeout(15_000) });
  const body = await response.arrayBuffer();
  return new Response(body.byteLength ? body : null, { status: response.status, statusText: response.statusText, headers: response.headers });
}
async function json(response) { return response.json().catch(() => ({})); }
async function check(ok, label, status) { if (!ok) { const error = new Error(); error.qaCode = "ASSERTION_FAILED"; error.qaLabel = label; error.status = status; throw error; } console.log(`[VERIFY PASS] ${label}`); }
function safeErrorCode(error) { return error?.name === "TimeoutError" || error?.name === "AbortError" ? "REQUEST_TIMEOUT" : /^[A-Z0-9_]+$/.test(error?.code ?? "") ? error.code : "UNCLASSIFIED_ERROR"; }
function payload(title, status = "draft", coverId = null, visibility = "private") {
  return { category: "learning", status, visibility, title, summary: `${title} summary`, projectUrl: "", repositoryUrl: "", coverId,
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Owned fixture ${runId}` }] }] } };
}
async function cleanup() {
  for (const id of entries) { try { const response = await request(`/api/admin/entries/${id}`, { method: "DELETE", write: true }); if (!response.ok && response.status !== 404) failures.push({ phase: "entry-cleanup", code: "CLEANUP_HTTP_STATUS", status: response.status }); } catch (error) { failures.push({ phase: "entry-cleanup", code: safeErrorCode(error) }); } }
  for (const id of mediaIds) { try { const response = await request(`/api/admin/media/${id}`, { method: "DELETE", write: true }); if (!response.ok && response.status !== 404) failures.push({ phase: "media-cleanup", code: "CLEANUP_HTTP_STATUS", status: response.status }); } catch (error) { failures.push({ phase: "media-cleanup", code: safeErrorCode(error) }); } }
  if (adminCookie) { try { const response = await request("/api/admin/auth/logout", { method: "POST", write: true }); if (!response.ok) failures.push({ phase: "logout-cleanup", code: "CLEANUP_HTTP_STATUS", status: response.status }); } catch (error) { failures.push({ phase: "logout-cleanup", code: safeErrorCode(error) }); } adminCookie = null; }
  password = "";
}

try {
  phase = "auth-preflight";
  const status = await json(await request("/api/admin/auth/status", { withAdmin: false }));
  await check(status.configured === true && status.authenticated === false, "admin auth status exposes configuration without authenticating");
  const anonymous = await request("/api/admin/entries", { withAdmin: false });
  await check(anonymous.status === 401 && (await json(anonymous)).error === "管理登录已过期或尚未登录，请在新标签页登录后台后再试。", "anonymous management access is denied before data is read", anonymous.status);
  const malformed = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: "not-json", write: true, withAdmin: false });
  await check(malformed.status === 401, "unauthorized write is rejected before parsing request body", malformed.status);
  const forged = await request("/api/admin/entries", { headers: { Cookie: `admin_session=${"0".repeat(64)}` }, withAdmin: false });
  await check(forged.status === 401, "forged admin cookie is rejected", forged.status);
  phase = "same-origin-checks";
  const missingOrigin = await request("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), withAdmin: false });
  await check(missingOrigin.status === 403, "login rejects missing Origin", missingOrigin.status);
  const crossSite = await request("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: base.origin, "Sec-Fetch-Site": "cross-site" }, body: JSON.stringify({ password }), withAdmin: false });
  await check(crossSite.status === 403, "login rejects cross-site fetch metadata", crossSite.status);

  phase = "admin-login";
  const login = await request("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), write: true, withAdmin: false });
  const loginBody = await json(login), setCookie = login.headers.get("set-cookie") ?? "";
  adminCookie = setCookie.split(";")[0] || null;
  await check(login.ok && loginBody.ok === true && /^admin_session=[0-9a-f]{64}$/i.test(adminCookie ?? "") && /httponly/i.test(setCookie) && /samesite=strict/i.test(setCookie) && /path=\//i.test(setCookie) && /max-age=43200/i.test(setCookie), "correct password creates a strict HttpOnly 12-hour admin session");
  password = "";
  const authState = await json(await request("/api/admin/auth/status"));
  await check(authState.configured === true && authState.authenticated === true, "admin auth status confirms the independent session");

  const badOriginPayload = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://invalid.example", "Sec-Fetch-Site": "cross-site" }, body: "not-json", withAdmin: true });
  await check(badOriginPayload.status === 403, "authenticated writes still require exact same-origin", badOriginPayload.status);
  phase = "admin-crud-and-media";
  const uploadForm = new FormData(); uploadForm.set("file", new File([png], "verify-admin.png", { type: "image/png" }));
  const upload = await request("/api/admin/media", { method: "POST", body: uploadForm, write: true });
  const uploadBody = await json(upload);
  await check(upload.ok && typeof uploadBody.id === "string", "authenticated admin can upload a fixture image");
  const mediaId = uploadBody.id; mediaIds.add(mediaId);
  const create = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(`${titlePrefix} create`, "draft", mediaId)), write: true });
  const createBody = await json(create);
  await check(create.status === 201 && typeof createBody.entry?.id === "string", "authenticated admin can create a private fixture entry");
  const entryId = createBody.entry.id; entries.add(entryId);
  const lifeTitle = `${titlePrefix} rejected life`;
  const rejectedLife = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(lifeTitle), category: "life" }), write: true });
  await check(rejectedLife.status === 400, "life category creation is rejected", rejectedLife.status);
  const afterRejectedLife = await json(await request("/api/admin/entries"));
  await check(!afterRejectedLife.entries?.some(entry => entry.title === lifeTitle), "rejected life content was not stored");
  const privateDetail = await request(`/api/entries/${entryId}`);
  const privateMedia = await request(`/api/media/${mediaId}`);
  const privateMediaHead = await request(`/api/media/${mediaId}`, { method: "HEAD" });
  await check(privateDetail.status === 404 && privateMedia.status === 404 && privateMediaHead.status === 404, "private fixture detail and media are hidden", privateDetail.status);
  const publishPublic = await request(`/api/admin/entries/${entryId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(`${titlePrefix} published public`, "published", mediaId, "public")), write: true });
  await check(publishPublic.ok, "fixture can be published as public");
  const publicDetail = await request(`/api/entries/${entryId}`);
  const publicMedia = await request(`/api/media/${mediaId}`);
  const publicMediaHead = await request(`/api/media/${mediaId}`, { method: "HEAD" });
  await check(publicDetail.status === 200 && publicMedia.status === 200 && publicMediaHead.status === 200, "public fixture detail and media are available", publicDetail.status);
  const publishPrivate = await request(`/api/admin/entries/${entryId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(`${titlePrefix} published private`, "published", mediaId, "private")), write: true });
  await check(publishPrivate.ok, "fixture can be changed to published private");
  const hiddenDetail = await request(`/api/entries/${entryId}`);
  const hiddenMedia = await request(`/api/media/${mediaId}`);
  const hiddenMediaHead = await request(`/api/media/${mediaId}`, { method: "HEAD" });
  await check(hiddenDetail.status === 404 && hiddenMedia.status === 404 && hiddenMediaHead.status === 404, "published private fixture detail and media are hidden", hiddenDetail.status);
  const list = await json(await request("/api/admin/entries"));
  await check(list.entries?.some((entry) => entry.id === entryId), "authenticated admin can list entries");
  const listedEntry = list.entries?.find((entry) => entry.id === entryId);
  await check(listedEntry && !Object.hasOwn(listedEntry, "body"), "admin entry list omits rich-text body payloads");
  const detail = await json(await request(`/api/admin/entries/${entryId}`));
  await check(detail.entry?.id === entryId && detail.entry.body?.type === "doc", "authenticated admin entry detail still includes the full body");
  const update = await request(`/api/admin/entries/${entryId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(`${titlePrefix} updated`, "draft", mediaId)), write: true });
  await check(update.ok && (await json(update)).entry?.title === `${titlePrefix} updated`, "authenticated admin can update its fixture entry");
  const adminMedia = await request(`/api/admin/media/${mediaId}`);
  const image = new Uint8Array(await adminMedia.arrayBuffer());
  await check(adminMedia.ok && image.length === png.length && image.every((byte, i) => byte === png[i]), "authenticated admin can read its uploaded fixture media");
  const head = await request(`/api/admin/media/${mediaId}`, { method: "HEAD" });
  await check(head.ok, "admin media HEAD uses the same authenticated gate");
  const remove = await request(`/api/admin/entries/${entryId}`, { method: "DELETE", write: true });
  await check(remove.ok, "authenticated admin can delete its fixture entry"); entries.delete(entryId);
  const removeMedia = await request(`/api/admin/media/${mediaId}`, { method: "DELETE", write: true });
  await check(removeMedia.ok, "authenticated admin can delete its unreferenced fixture media"); mediaIds.delete(mediaId);

  phase = "admin-logout";
  const previousCookie = adminCookie;
  const logout = await request("/api/admin/auth/logout", { method: "POST", write: true });
  await check(logout.ok && (logout.headers.get("set-cookie") ?? "").includes("Max-Age=0"), "logout revokes and clears the admin session");
  adminCookie = null;
  const replay = await request("/api/admin/entries", { headers: { Cookie: previousCookie }, withAdmin: false });
  await check(replay.status === 401, "revoked admin cookie cannot be replayed");
} catch (error) {
  const code = error?.qaCode || (error?.name === "TimeoutError" || error?.name === "AbortError" ? "REQUEST_TIMEOUT" : /^[A-Z0-9_]+$/.test(error?.code ?? "") ? error.code : "UNCLASSIFIED_ERROR");
  const label = typeof error?.qaLabel === "string" && error.qaLabel.length <= 180 && /^[\p{L}\p{N} \p{P}]+$/u.test(error.qaLabel) ? error.qaLabel : undefined;
  failures.push({ phase, code, ...(Number.isInteger(error?.status) ? { status: error.status } : {}), ...(Number.isInteger(error?.exitCode) ? { exitCode: error.exitCode } : {}) });
  if (label) failures.at(-1).label = label;
} finally { await cleanup(); }

if (failures.length) { for (const failure of failures) console.error(`[VERIFY FAIL] phase=${failure.phase} code=${failure.code}${failure.status === undefined ? "" : ` status=${failure.status}`}${failure.exitCode === undefined ? "" : ` exitCode=${failure.exitCode}`}${failure.label ? ` label=${failure.label}` : ""}`); process.exitCode = 1; }
