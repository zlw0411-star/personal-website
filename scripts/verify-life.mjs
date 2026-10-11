import { randomUUID } from "node:crypto";

const base = new URL("http://127.0.0.1:5173");
const runId = randomUUID();
const titlePrefix = `[verify-life:${runId}]`;
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V7sAAAAASUVORK5CYII=", "base64"));
const createdEntries = new Set();
const createdMedia = new Set();
let cookie = null;
let adminCookie = null;
const failures = [];

let passwordInput = "";
for await (const chunk of process.stdin) {
  passwordInput += chunk.toString();
  if (Buffer.byteLength(passwordInput, "utf8") > 1024) throw new Error("Password input is too large.");
}
let lifePassword = passwordInput.replace(/\r?\n$/, "");
let adminPassword = lifePassword;
passwordInput = "";
if (lifePassword.startsWith("{")) {
  let supplied;
  try { supplied = JSON.parse(lifePassword); } catch { throw new Error("Invalid stdin password JSON."); }
  if (!supplied || typeof supplied !== "object" || typeof supplied.lifePassword !== "string" || typeof supplied.adminPassword !== "string") throw new Error("Provide {\"lifePassword\":...,\"adminPassword\":...} on stdin.");
  lifePassword = supplied.lifePassword; adminPassword = supplied.adminPassword;
}
if ([lifePassword, adminPassword].some((value) => value.length < 8 || value.length > 256)) throw new Error("Passwords must be 8–256 characters and supplied on stdin.");

async function request(route, options = {}) {
  const headers = new Headers(options.headers);
  if (options.write) { headers.set("Origin", base.origin); headers.set("Sec-Fetch-Site", "same-origin"); }
  if (!headers.has("Cookie")) {
    const cookiePairs = [];
    if (cookie && options.withCookie !== false) cookiePairs.push(cookie);
    if (adminCookie && route.startsWith("/api/admin/") && options.withAdminCookie !== false) cookiePairs.push(adminCookie);
    if (cookiePairs.length) headers.set("Cookie", cookiePairs.join("; "));
  }
  return fetch(new URL(route, base), { ...options, headers });
}
async function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}
async function body(response) { return response.json().catch(() => ({})); }
async function uploadImage(name) {
  const form = new FormData(); form.set("file", new File([png], `${name}.png`, { type: "image/png" }));
  const response = await request("/api/admin/media", { method: "POST", body: form, write: true });
  const value = await body(response);
  if (!response.ok || typeof value.id !== "string") throw new Error(`Fixture image upload failed (${response.status}).`);
  createdMedia.add(value.id); return value.id;
}
function entry(category, status, visibility, title, imageId = null, projectUrl = "", repositoryUrl = "") {
  return {
    category, status, visibility, title, summary: `${title} summary`, coverId: imageId,
    projectUrl, repositoryUrl,
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Private verification fixture ${runId}.` }] }, ...(imageId ? [{ type: "image", attrs: { mediaId: imageId, src: `/api/admin/media/${imageId}` } }] : [])] },
  };
}
async function createEntry(value) {
  const response = await request("/api/admin/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), write: true });
  const result = await body(response);
  if (!response.ok || typeof result.entry?.id !== "string") throw new Error(`Fixture entry creation failed (${response.status}).`);
  createdEntries.add(result.entry.id); return result.entry;
}
async function expectHidden(route, label, requestCookie = null) {
  const response = await request(route, { headers: requestCookie ? { Cookie: requestCookie } : {}, withCookie: false });
  await check(response.status === 404, label);
}
async function cleanup() {
  try {
    const response = await request("/api/admin/entries", { withCookie: false });
    const value = await body(response);
    for (const item of value.entries ?? []) if (typeof item.title === "string" && item.title.startsWith(titlePrefix)) createdEntries.add(item.id);
  } catch { /* continue cleaning known IDs */ }
  for (const id of createdEntries) {
    try { const response = await request(`/api/admin/entries/${encodeURIComponent(id)}`, { method: "DELETE", write: true, withCookie: false }); if (!response.ok && response.status !== 404) failures.push(`Fixture entry cleanup failed (${response.status}).`); }
    catch { failures.push("Fixture entry cleanup failed."); }
  }
  if (cookie) {
    try { const response = await request("/api/life/lock", { method: "POST", write: true }); if (!response.ok) failures.push(`Life session cleanup failed (${response.status}).`); }
    catch { failures.push("Life session cleanup failed."); }
    cookie = null;
  }
  for (const id of createdMedia) {
    try { const response = await request(`/api/admin/media/${encodeURIComponent(id)}`, { method: "DELETE", write: true, withCookie: false }); if (!response.ok && response.status !== 404) failures.push(`Fixture media cleanup failed (${response.status}).`); }
    catch { failures.push("Fixture media cleanup failed."); }
  }
  if (adminCookie) {
    try { const response = await request("/api/admin/auth/logout", { method: "POST", write: true }); if (!response.ok) failures.push(`Admin session cleanup failed (${response.status}).`); }
    catch { failures.push("Admin session cleanup failed."); }
    adminCookie = null;
  }
}

try {
  const adminLogin = await request("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: adminPassword }), write: true, withAdminCookie: false });
  const adminLoginBody = await body(adminLogin);
  const adminSetCookie = adminLogin.headers.get("set-cookie") ?? "";
  const adminPair = adminSetCookie.split(";")[0];
  await check(adminLogin.ok && adminLoginBody.ok === true && /^admin_session=[0-9a-f]{64}$/i.test(adminPair), "admin password independently authenticates verification management requests");
  adminCookie = adminPair;
  const configResponse = await request("/api/admin/life-password", { withCookie: false });
  const config = await body(configResponse);
  await check(configResponse.ok && config.configured === true, "life password is configured");

  const lifeImage = await uploadImage("life-published");
  const draftImage = await uploadImage("life-draft");
  const privateImage = await uploadImage("experience-private");
  const publicImage = await uploadImage("experience-public");
  const publishedLife = await createEntry(entry("life", "published", "public", `${titlePrefix} life published`, lifeImage));
  const draftLife = await createEntry(entry("life", "draft", "public", `${titlePrefix} life draft`, draftImage));
  const privateExperience = await createEntry(entry("learning", "published", "private", `${titlePrefix} experience private`, privateImage));
  const publicExperience = await createEntry(entry("project", "published", "public", `${titlePrefix} experience public`, publicImage, "https://example.com/verify-life", "https://github.com/example/verify-life"));
  await check(publicExperience.category === "learning" && publicExperience.projectUrl === "https://example.com/verify-life" && publicExperience.repositoryUrl === "https://github.com/example/verify-life", "legacy project input maps to experience and preserves both URLs");
  await check(publishedLife.visibility === "private" && draftLife.visibility === "private", "life entries are stored private regardless of submitted visibility");
  const anonymousList = await body(await request("/api/entries", { withCookie: false }));
  await check(!anonymousList.entries?.some((item) => item.id === publishedLife.id || item.id === draftLife.id), "default public list excludes all life entries");

  const noOrigin = await request("/api/life/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: lifePassword }) });
  await check(noOrigin.status === 403, "unlock rejects missing Origin");
  const crossSite = await fetch(new URL("/api/life/lock", base), { method: "POST", headers: { Origin: base.origin, "Sec-Fetch-Site": "cross-site" } });
  await check(crossSite.status === 403, "lock rejects cross-site fetch metadata");

  const wrongPassword = `${lifePassword[0] === "x" ? "y" : "x"}${lifePassword.slice(1)}`;
  const wrongResponse = await request("/api/life/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: wrongPassword }), write: true, withCookie: false });
  const wrongBody = await body(wrongResponse);
  await check(wrongResponse.status === 401 && !JSON.stringify(wrongBody).includes(wrongPassword), "wrong password is rejected without echoing it");

  await expectHidden(`/api/entries/${publishedLife.id}`, "anonymous life details return 404");
  await expectHidden(`/api/media/${lifeImage}`, "anonymous life media returns 404");
  const anonymousLifeHead = await request(`/api/media/${lifeImage}`, { method: "HEAD", withCookie: false });
  await check(anonymousLifeHead.status === 404, "anonymous media HEAD follows life access rules");
  await expectHidden(`/api/media/${draftImage}`, "draft life media returns 404");
  const forgedCookie = `life_session=${"0".repeat(64)}`;
  await expectHidden(`/api/entries/${publishedLife.id}`, "forged session cannot read life details", forgedCookie);
  await expectHidden(`/api/media/${lifeImage}`, "forged session cannot read life media", forgedCookie);
  const forgedStatusResponse = await request("/api/life/status", { headers: { Cookie: forgedCookie }, withCookie: false });
  const forgedStatus = await body(forgedStatusResponse);
  await check(forgedStatus.configured === true && forgedStatus.unlocked === false, "forged cookie does not unlock life status");
  const lockedLifeList = await request("/api/entries?category=life", { withCookie: false });
  await check(lockedLifeList.status === 401, "locked life list requires unlock");
  const lockedLifePage = await request("/life", { withCookie: false });
  const lockedLifeHtml = await lockedLifePage.text();
  await check(lockedLifePage.ok && !lockedLifeHtml.includes(publishedLife.title) && !lockedLifeHtml.includes(publishedLife.summary) && !lockedLifeHtml.includes(draftLife.title), "locked life page does not leak titles or summaries");
  await check(lockedLifePage.headers.get("cache-control")?.includes("no-store") && lockedLifePage.headers.get("vary")?.toLowerCase().includes("cookie"), "locked life page is private and varies by cookie");
  const lockedDetailPage = await request(`/entries/${publishedLife.id}`, { withCookie: false });
  const lockedDetailHtml = await lockedDetailPage.text();
  await check(!lockedDetailHtml.includes(publishedLife.title) && !lockedDetailHtml.includes(publishedLife.summary), "locked life detail page does not leak title or summary");

  const unlock = await request("/api/life/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: lifePassword }), write: true, withCookie: false });
  const unlockBody = await body(unlock);
  const setCookie = unlock.headers.get("set-cookie") ?? "";
  const sessionPair = setCookie.split(";")[0];
  await check(unlock.ok && unlockBody.ok === true && /^life_session=[0-9a-f]{64}$/i.test(sessionPair) && /httponly/i.test(setCookie) && /samesite=strict/i.test(setCookie) && /path=\//i.test(setCookie) && /max-age=43200/i.test(setCookie), "correct password creates a strict HttpOnly 12-hour life session");
  cookie = sessionPair;
  const status = await body(await request("/api/life/status"));
  await check(status.configured === true && status.unlocked === true, "session unlock state is reported");

  const lifeDetailResponse = await request(`/api/entries/${publishedLife.id}`);
  const lifeDetail = await body(lifeDetailResponse);
  await check(lifeDetailResponse.ok && lifeDetail.entry?.id === publishedLife.id && lifeDetail.entry.visibility === "private", "unlocked session reads published life details");
  const unlockedLifePage = await request("/life");
  const unlockedLifeHtml = await unlockedLifePage.text();
  await check(unlockedLifePage.ok && unlockedLifeHtml.includes(publishedLife.title) && !unlockedLifeHtml.includes(draftLife.title), "unlocked life page shows published entries without drafts");
  const unlockedDetailPage = await request(`/entries/${publishedLife.id}`);
  const unlockedDetailHtml = await unlockedDetailPage.text();
  await check(unlockedDetailPage.ok && unlockedDetailHtml.includes(publishedLife.title) && unlockedDetailHtml.includes(publishedLife.summary), "unlocked life detail page shows its published content");
  const lifeList = await body(await request("/api/entries?category=life"));
  await check(lifeList.entries?.some((item) => item.id === publishedLife.id) && !lifeList.entries?.some((item) => item.id === draftLife.id), "unlocked life list includes published entries, not drafts");
  await expectHidden(`/api/entries/${draftLife.id}`, "life drafts remain hidden after unlock", cookie);
  await expectHidden(`/api/media/${draftImage}`, "draft-only media remains hidden after unlock", cookie);
  const lifeMedia = await request(`/api/media/${lifeImage}`);
  await check(lifeMedia.ok && lifeMedia.headers.get("content-type")?.startsWith("image/png"), "unlocked session reads media used by published life entry");
  const unlockedLifeHead = await request(`/api/media/${lifeImage}`, { method: "HEAD" });
  await check(unlockedLifeHead.ok, "unlocked media HEAD follows life access rules");

  await expectHidden(`/api/entries/${privateExperience.id}`, "private experience remains hidden after life unlock", cookie);
  await expectHidden(`/api/media/${privateImage}`, "private experience media is hidden", cookie);
  const privateExperiencePage = await request(`/entries/${privateExperience.id}`);
  const privateExperienceHtml = await privateExperiencePage.text();
  await check(privateExperiencePage.status === 404 && !privateExperienceHtml.includes(privateExperience.title) && !privateExperienceHtml.includes(privateExperience.summary), "life session does not reveal private experience page");
  const publicExperienceResponse = await request(`/api/entries/${publicExperience.id}`);
  const publicExperienceBody = await body(publicExperienceResponse);
  await check(publicExperienceResponse.ok && publicExperienceBody.entry?.id === publicExperience.id && publicExperienceBody.entry.category === "learning" && publicExperienceBody.entry.projectUrl === "https://example.com/verify-life" && publicExperienceBody.entry.repositoryUrl === "https://github.com/example/verify-life", "public experience remains available and keeps legacy project links");
  const publicMediaResponse = await request(`/api/media/${publicImage}`);
  await check(publicMediaResponse.ok, "public experience image remains available");
  const projectDetailPage = await request(`/entries/${publicExperience.id}`);
  const projectDetailHtml = await projectDetailPage.text();
  await check(projectDetailPage.ok && projectDetailHtml.includes("https://example.com/verify-life") && projectDetailHtml.includes("https://github.com/example/verify-life"), "legacy project links appear on the experience detail page");

  const previousCookie = cookie;
  const lock = await request("/api/life/lock", { method: "POST", write: true });
  await check(lock.ok && (lock.headers.get("set-cookie") ?? "").includes("Max-Age=0"), "lock revokes session and clears cookie");
  cookie = null;
  const lockedStatus = await body(await request("/api/life/status"));
  await check(lockedStatus.configured === true && lockedStatus.unlocked === false, "locked state is reported after logout");
  await expectHidden(`/api/entries/${publishedLife.id}`, "life details are hidden after logout");
  await expectHidden(`/api/media/${lifeImage}`, "life media is hidden after logout");
  await expectHidden(`/api/entries/${publishedLife.id}`, "revoked session cannot replay life details", previousCookie);
  await expectHidden(`/api/media/${lifeImage}`, "revoked session cannot replay life media", previousCookie);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
  lifePassword = ""; adminPassword = "";
}

if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exitCode = 1;
}
