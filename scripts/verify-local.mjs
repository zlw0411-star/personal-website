import { access, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = path.join(root, ".sites-runtime");
const fixturePath = path.join(runtime, "verify-fixture.json");
const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5173");
if (!/^https?:$/.test(base.protocol) || base.username || base.password || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(base.hostname)) throw new Error("BASE_URL 仅支持无凭据的 loopback 地址");
const origin = base.origin;
let passwordInput = "";
for await (const chunk of process.stdin) { passwordInput += chunk.toString(); if (Buffer.byteLength(passwordInput, "utf8") > 1024) throw new Error("密码输入过长"); }
let adminPassword = passwordInput.replace(/\r?\n$/, ""); passwordInput = "";
if (adminPassword.length < 8 || adminPassword.length > 256) throw new Error("请通过 stdin 提供 8 至 256 位管理密码。");
const fixturePrefix = `本地验收 ${new Date().toISOString()}`;
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V7sAAAAASUVORK5CYII=", "base64"));
let entryId = null, mediaId = null;
const failures = [];
let originalProfile = null, profileChanged = false, fixturePersisted = false, fixturePreparationStarted = false, persistenceChecksPassed = false;
let adminCookie = null;

async function request(route, options = {}) {
  const headers = new Headers(options.headers);
  if (options.write) headers.set("Origin", origin);
  if (options.write) headers.set("Sec-Fetch-Site", "same-origin");
  if (adminCookie && route.startsWith("/api/admin/") && !headers.has("cookie")) headers.set("Cookie", adminCookie);
  const response = await fetch(new URL(route, base), { ...options, headers });
  return response;
}
async function expect(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}
async function responseJson(response) {
  return response.json().catch(() => ({}));
}
function entry(status, visibility, title) {
  return { category: "learning", title, summary: `${fixturePrefix} 摘要`, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "仅由 verify-local.mjs 创建的临时记录。" }] }, ...(mediaId ? [{ type: "paragraph", content: [{ type: "text", text: "图片：" }] }, { type: "image", attrs: { src: `/api/admin/media/${mediaId}`, alt: "本地验收图片", title: null, width: null, height: null, mediaId } }] : [])] }, coverId: mediaId, status, visibility, projectUrl: "", repositoryUrl: "" };
}
async function createMedia() {
  const form = new FormData();
  form.set("file", new File([png], "verify-local.png", { type: "image/png" }));
  const response = await request("/api/admin/media", { method: "POST", body: form, write: true });
  const body = await responseJson(response);
  if (!response.ok || typeof body.id !== "string") throw new Error(`上传验收图片失败 (${response.status}): ${body.error ?? "未知错误"}`);
  mediaId = body.id;
  console.log("✓ 上传 1×1 PNG 图片");
}
async function createEntry(payload) {
  const response = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), write: true });
  const body = await responseJson(response);
  if (!response.ok || typeof body.entry?.id !== "string") throw new Error(`创建验收文章失败 (${response.status}): ${body.error ?? "未知错误"}`);
  entryId = body.entry.id;
  return body.entry;
}
async function putEntry(payload) {
  const response = await request(`/api/admin/entries/${encodeURIComponent(entryId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), write: true });
  if (!response.ok) throw new Error(`更新验收文章失败 (${response.status}): ${(await responseJson(response)).error ?? "未知错误"}`);
  return responseJson(response);
}
async function restoreProfile() {
  if (!profileChanged || !originalProfile) return;
  const response = await request("/api/admin/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(originalProfile), write: true });
  if (!response.ok) throw new Error(`个人资料恢复失败 (${response.status})`);
  console.log("✓ 恢复原个人资料");
  profileChanged = false;
}
async function cleanup() {
  try { await restoreProfile(); } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
  if (entryId) {
    const response = await request(`/api/admin/entries/${encodeURIComponent(entryId)}`, { method: "DELETE", write: true });
    if (!response.ok && response.status !== 404) failures.push(`验收文章清理失败 (${response.status})，记录 ID：${entryId}`);
    else { console.log("✓ 清理本脚本创建的文章"); entryId = null; }
  }
  if (mediaId) {
    const response = await request(`/api/admin/media/${encodeURIComponent(mediaId)}`, { method: "DELETE", write: true });
    if (!response.ok && response.status !== 404) failures.push(`验收图片清理失败 (${response.status})，媒体 ID：${mediaId}`);
    else { console.log("✓ 清理本脚本创建的媒体"); mediaId = null; }
  }
}
async function testGuards() {
  const payload = entry("draft", "private", `${fixturePrefix} 安全检查`);
  const noOrigin = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  await expect(noOrigin.status === 403, "写入请求缺少 Origin 时拒绝");
  const badOrigin = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://invalid.example", "Sec-Fetch-Site": "cross-site" }, body: JSON.stringify(payload) });
  await expect(badOrigin.status === 403, "跨站写入请求拒绝");
  const badForm = new FormData(); badForm.set("file", new File(["not an image"], "bad.txt", { type: "text/plain" }));
  const badFile = await request("/api/admin/media", { method: "POST", body: badForm, write: true });
  await expect(badFile.status === 400, "拒绝非图片上传");
  const badImageOrigin = await request("/api/admin/media", { method: "POST", headers: { Origin: "https://invalid.example", "Sec-Fetch-Site": "cross-site" }, body: badForm });
  await expect(badImageOrigin.status === 403, "跨站图片上传请求拒绝");
  const noImageOrigin = await request("/api/admin/media", { method: "POST", body: badForm });
  await expect(noImageOrigin.status === 403, "缺少 Origin 的图片上传请求拒绝");
  const badLinkPayload = { ...entry("draft", "private", `${fixturePrefix} 链接检查`), body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "不安全链接", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] } };
  const badLink = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badLinkPayload), write: true });
  await expect(badLink.status === 400, "拒绝 javascript: 富文本链接");
  const badProject = { ...payload, projectUrl: "javascript:alert(1)" };
  const badProjectResponse = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badProject), write: true });
  await expect(badProjectResponse.status === 400, "拒绝 javascript: 项目链接");
  const invalidMediaId = "00000000-0000-4000-8000-000000000001";
  const missingMedia = { ...payload, coverId: invalidMediaId, body: { type: "doc", content: [{ type: "image", attrs: { mediaId: invalidMediaId } }] } };
  const missingMediaResponse = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(missingMedia), write: true });
  const afterMissingMedia = await responseJson(await request("/api/admin/entries"));
  const accidentalEntry = afterMissingMedia.entries?.find(x => x.title === payload.title);
  if (accidentalEntry) entryId = accidentalEntry.id;
  await expect(!missingMediaResponse.ok && !accidentalEntry, "拒绝引用不存在的封面或正文媒体");
  const profileResponse = await request("/api/admin/profile");
  const profileBody = await responseJson(profileResponse);
  await expect(profileResponse.ok && profileBody.profile, "读取待恢复的原个人资料");
  originalProfile = profileBody.profile;
  const badProfile = { ...originalProfile, links: [{ label: "unsafe", url: "javascript:alert(1)" }] };
  const badProfileResponse = await request("/api/admin/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badProfile), write: true });
  await expect(badProfileResponse.status === 400, "拒绝 javascript: 个人资料链接");
  const badAvatar = { ...originalProfile, avatarId: invalidMediaId };
  profileChanged = true;
  const badAvatarResponse = await request("/api/admin/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badAvatar), write: true });
  await expect(!badAvatarResponse.ok, "拒绝引用不存在的个人头像媒体");
  profileChanged = false;
}
async function testProfileRoundTrip() {
  const updated = { ...originalProfile, nickname: `${originalProfile.nickname}（验收）`, avatarId: mediaId, links: [...originalProfile.links, { label: "验收链接", url: "https://example.com/verify-local" }] };
  profileChanged = true;
  const response = await request("/api/admin/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated), write: true });
  await expect(response.ok, "保存包含验收头像与链接的个人资料");
  const publicResponse = await request("/api/profile");
  const body = await responseJson(publicResponse);
  await expect(publicResponse.ok && body.profile?.nickname === updated.nickname && body.profile.avatarId === mediaId, "公开个人资料读取已保存的头像和昵称");
  const avatarResponse = await request(`/api/media/${encodeURIComponent(mediaId)}`);
  await expect(avatarResponse.ok, "公开个人头像媒体可读取");
  await restoreProfile();
}
async function createFixture(mode) {
  try { await access(fixturePath); throw new Error(`持久化验收 fixture 已存在，请先运行 --check-persistence：${fixturePath}`); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  fixturePreparationStarted = true;
  await createMedia();
  const token = crypto.randomUUID();
  const title = `${fixturePrefix} 临时持久化验收 [local-verify:${token}]`;
  const created = await createEntry(entry("draft", "private", title));
  await mkdir(runtime, { recursive: true });
  await writeFile(fixturePath, JSON.stringify({ version: 1, entryId: created.id, mediaId, title, token }, null, 2), "utf8");
  fixturePersisted = true;
  console.log(`✓ 已准备重启验收数据，文章 ID：${created.id}`);
  console.log(`重启本地服务器后运行：node scripts/verify-local.mjs --check-persistence`);
  if (mode === "--prepare-persistence") process.exitCode = 0;
}
async function checkFixture() {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  if (fixture.version !== 1 || !/^[0-9a-f-]{36}$/i.test(fixture.entryId ?? "") || !/^[0-9a-f-]{36}$/i.test(fixture.mediaId ?? "") || !/^[0-9a-f-]{36}$/i.test(fixture.token ?? "") || typeof fixture.title !== "string" || !fixture.title.startsWith("本地验收 ") || !fixture.title.endsWith(`[local-verify:${fixture.token}]`)) throw new Error("持久化 fixture 格式无效；保留文件与数据，不执行清理");
  const response = await request(`/api/admin/entries/${encodeURIComponent(fixture.entryId)}`);
  const body = await responseJson(response);
  await expect(response.ok && body.entry?.title === fixture.title && body.entry.status === "draft" && body.entry.visibility === "private" && body.entry.coverId === fixture.mediaId, "服务器重启后自有私密验收文章仍存在");
  const mediaResponse = await request(`/api/admin/media/${encodeURIComponent(fixture.mediaId)}`);
  const mediaBytes = new Uint8Array(await mediaResponse.arrayBuffer());
  await expect(mediaResponse.ok && mediaBytes.length === png.length && mediaBytes.every((byte, i) => byte === png[i]), "服务器重启后 R2 验收图片字节保持一致");
  entryId = fixture.entryId; mediaId = fixture.mediaId;
  persistenceChecksPassed = true;
}

const mode = process.argv[2] || "--all";
try {
  const login = await fetch(new URL("/api/admin/auth/login", base), { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify({ password: adminPassword }) });
  adminCookie = (login.headers.get("set-cookie") ?? "").split(";")[0] || null;
  if (!login.ok || !/^admin_session=[0-9a-f]{64}$/i.test(adminCookie ?? "")) throw new Error(`管理登录失败 (${login.status})`);
  adminPassword = "";
  if (mode === "--prepare-persistence") await createFixture(mode);
  else if (mode === "--check-persistence") await checkFixture();
  else if (mode === "--all") {
    await testGuards();
    await createMedia();
    await testProfileRoundTrip();
    await createEntry(entry("draft", "private", `${fixturePrefix} 暂存`));
    let response = await request(`/api/entries/${encodeURIComponent(entryId)}`);
    await expect(response.status === 404, "草稿文章详情不可公开");
    response = await request(`/api/media/${encodeURIComponent(mediaId)}`);
    await expect(response.status === 404, "草稿图片不可公开读取");
    response = await request("/api/admin/entries");
    const adminList = await responseJson(response);
    await expect(response.ok && adminList.entries?.some(x => x.id === entryId), "管理列表可见草稿");
    await putEntry(entry("draft", "private", `${fixturePrefix} 已更新`));
    await expect(true, "更新草稿成功");
    await putEntry(entry("published", "private", `${fixturePrefix} 私密发布`));
    response = await request(`/api/entries/${encodeURIComponent(entryId)}`);
    await expect(response.status === 404, "私密已发布文章详情不可公开");
    response = await request("/api/entries?category=learning");
    let listBody = await responseJson(response);
    await expect(response.ok && !listBody.entries?.some(x => x.id === entryId), "私密已发布文章不出现在公开分类列表");
    response = await request(`/api/media/${encodeURIComponent(mediaId)}`);
    await expect(response.status === 404, "私密文章图片不可公开读取");
    await putEntry(entry("published", "public", `${fixturePrefix} 公开文章`));
    response = await request(`/api/entries/${encodeURIComponent(entryId)}`);
    let body = await responseJson(response);
    await expect(response.ok && body.entry?.id === entryId && body.entry.coverId === mediaId, "公开文章详情及图片引用可读取");
    response = await request("/api/entries?category=learning"); listBody = await responseJson(response);
    await expect(response.ok && listBody.entries?.some(x => x.id === entryId), "公开分类列表包含文章");
    response = await request(`/api/media/${encodeURIComponent(mediaId)}`);
    await expect(response.ok && response.headers.get("content-type")?.startsWith("image/png"), "公开文章图片可读取");
    response = await request(`/api/admin/media/${encodeURIComponent(mediaId)}`, { method: "DELETE", write: true });
    await expect(response.status === 409, "拒绝删除被公开文章引用的媒体");
    await putEntry(entry("published", "private", `${fixturePrefix} 再次私密`));
    response = await request(`/api/entries/${encodeURIComponent(entryId)}`);
    await expect(response.status === 404, "公开文章转私密后详情立即不可读取");
    response = await request("/api/entries?category=learning"); listBody = await responseJson(response);
    await expect(response.ok && !listBody.entries?.some(x => x.id === entryId), "公开文章转私密后立即退出分类列表");
    response = await request(`/api/media/${encodeURIComponent(mediaId)}`);
    await expect(response.status === 404, "公开文章转私密后图片立即不可读取");
    await putEntry(entry("published", "public", `${fixturePrefix} 再次公开`));
    response = await request(`/api/entries/${encodeURIComponent(entryId)}`);
    await expect(response.ok, "私密文章重新公开后详情恢复");
  } else throw new Error("用法：node scripts/verify-local.mjs [--all|--prepare-persistence|--check-persistence]");
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  if (mode === "--all" || mode === "--check-persistence" || (mode === "--prepare-persistence" && !fixturePersisted)) await cleanup();
  if (adminCookie) { try { await request("/api/admin/auth/logout", { method: "POST", write: true }); } catch { /* best-effort session cleanup */ } adminCookie = null; }
  adminPassword = "";
  if (mode === "--check-persistence" && persistenceChecksPassed && failures.length === 0) { await rm(fixturePath, { force: true }); console.log("✓ 清理重启验收 fixture 文件"); }
  if (mode === "--prepare-persistence" && fixturePreparationStarted && !fixturePersisted) await rm(fixturePath, { force: true });
}
if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exitCode = 1;
}
