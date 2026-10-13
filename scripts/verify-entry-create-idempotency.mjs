import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { mkdir, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const runtimeRoot = path.resolve(root, ".sites-runtime");
const tempName = `entry-create-${randomUUID()}`;
const tempRoot = path.join(runtimeRoot, tempName);
const dbPath = path.join(tempRoot, "d1");
const workerPath = path.join(tempRoot, "worker.mjs");
const runtimePrefix = `${runtimeRoot}${path.sep}`;
let ownsTemp = false;
let mf;

const harness = `
import { createEntry, getAdminEntry, saveEntry } from "@/lib/server/content";
export default { async fetch(request) {
  const url = new URL(request.url);
  try {
    if (request.method === "POST" && url.pathname === "/entries") {
      const input = await request.json();
      const key = request.headers.get("Idempotency-Key");
      if (key) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return Response.json({ error: "invalid key" }, { status: 400 });
        const result = await createEntry(key, input);
        return Response.json({ entry: result.entry }, { status: result.created ? 201 : 200 });
      }
      return Response.json({ entry: await saveEntry(null, input) }, { status: 201 });
    }
    if (request.method === "GET" && url.pathname.startsWith("/entries/")) {
      const entry = await getAdminEntry(decodeURIComponent(url.pathname.slice("/entries/".length)));
      return entry ? Response.json({ entry }) : Response.json({ error: "missing" }, { status: 404 });
    }
    return new Response(null, { status: 404 });
  } catch (error) {
    if (error?.code === "ENTRY_CREATE_CONFLICT") return Response.json({ error: "conflict" }, { status: 409 });
    return Response.json({ error: "isolated operation failed", errorName: error?.name ?? "unknown", errorCode: error?.code ?? "none", errorMessage: error?.message ?? "none" }, { status: 500 });
  }
} };
`;

function verifiedTempPath(candidate) {
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(runtimePrefix) || path.basename(resolved) !== tempName || !/^entry-create-[0-9a-f-]{36}$/iu.test(path.basename(resolved))) {
    throw new Error("Refusing to access a path outside this isolated fixture directory.");
  }
  return resolved;
}

async function startWorker() {
  mf = new Miniflare({ scriptPath: workerPath, modules: true, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "entry-create-fixture" }, d1Persist: dbPath });
  return mf.getWorker();
}

async function post(worker, input, key) {
  const headers = { "Content-Type": "application/json" };
  if (key !== undefined) headers["Idempotency-Key"] = key;
  return worker.fetch("http://entry-create.test/entries", { method: "POST", headers, body: JSON.stringify(input) });
}

const base = (title, bodyText, coverId = null, bodyMediaId = null) => ({
  category: "learning", status: "draft", visibility: "private", title, summary: "fixture", projectUrl: "", repositoryUrl: "", coverId,
  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: bodyText }] }, ...(bodyMediaId ? [{ type: "image", attrs: { mediaId: bodyMediaId } }] : [])] },
});

try {
  await mkdir(runtimeRoot, { recursive: true });
  const runtimeReal = await realpath(runtimeRoot);
  const target = verifiedTempPath(tempRoot);
  if (!target.startsWith(`${runtimeReal}${path.sep}`)) throw new Error("Fixture path is outside the resolved runtime directory.");
  await mkdir(target, { recursive: false });
  ownsTemp = true;
  await build({ stdin: { contents: harness, resolveDir: root, sourcefile: "entry-create-harness.ts", loader: "ts" }, bundle: true, format: "esm", platform: "browser", target: "es2022", tsconfig: path.join(root, "tsconfig.json"), external: ["cloudflare:workers"], outfile: workerPath, logLevel: "silent" });

  const migrationDir = path.join(root, "drizzle");
  const migrations = (await readdir(migrationDir)).filter(name => /^\d{4}_.*\.sql$/u.test(name)).sort();
  if (!migrations.length) throw new Error("No Drizzle migrations found.");
  let worker = await startWorker();
  let d1 = await mf.getD1Database("DB");
  for (const name of migrations) {
    const contents = (await readFile(path.join(migrationDir, name), "utf8")).replace(/--> statement-breakpoint/gu, "");
    for (const statement of contents.split(";").map(value => value.trim()).filter(Boolean)) await d1.prepare(statement).run();
  }

  const mediaA = randomUUID(), mediaB = randomUUID(), mediaC = randomUUID();
  for (const mediaId of [mediaA, mediaB, mediaC]) await d1.prepare("INSERT INTO media(id,object_key,mime_type,size,created_at) VALUES(?,?,?,?,?)")
    .bind(mediaId, `${mediaId}.png`, "image/png", 1, new Date().toISOString()).run();

  const key = randomUUID(), input = base("retry fixture", "stable body", mediaA, mediaB);
  const first = await post(worker, input, key);
  const firstBody = await first.json();
  assert.equal(first.status, 201, `first create failed: ${firstBody.errorName}/${firstBody.errorCode}: ${firstBody.errorMessage}`);
  assert.equal(firstBody.entry.id, key);
  const replay = await post(worker, input, key);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).entry.id, key);
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entries WHERE id=?").bind(key).first()).count, 1);
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entry_media WHERE entry_id=?").bind(key).first()).count, 2);
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entry_media WHERE entry_id=? AND media_id=?").bind(key, mediaB).first()).count, 1);

  const changed = base("retry fixture", "changed body", mediaC, mediaB);
  const conflict = await post(worker, changed, key);
  assert.equal(conflict.status, 409);
  const stillOriginal = await (await worker.fetch(`http://entry-create.test/entries/${key}`)).json();
  assert.equal(stillOriginal.entry.body.content[0].content[0].text, "stable body");
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entry_media WHERE entry_id=? AND media_id=?").bind(key, mediaA).first()).count, 1);
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entry_media WHERE entry_id=? AND media_id=?").bind(key, mediaB).first()).count, 1);
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entry_media WHERE entry_id=? AND media_id=?").bind(key, mediaC).first()).count, 0);

  const concurrentKey = randomUUID(), concurrentInput = base("concurrent fixture", "same body", mediaA, mediaB);
  const concurrent = await Promise.all([post(worker, concurrentInput, concurrentKey), post(worker, concurrentInput, concurrentKey)]);
  assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 201]);
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entries WHERE id=?").bind(concurrentKey).first()).count, 1);
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entry_media WHERE entry_id=?").bind(concurrentKey).first()).count, 2);

  const competingKey = randomUUID();
  const competing = await Promise.all([post(worker, base("competing A", "A", mediaA, mediaB), competingKey), post(worker, base("competing B", "B", mediaC), competingKey)]);
  assert.deepEqual(competing.map(response => response.status).sort(), [201, 409]);
  const winner = await (await worker.fetch(`http://entry-create.test/entries/${competingKey}`)).json();
  const expectedWinnerMedia = winner.entry.title === "competing A" ? [mediaA, mediaB] : [mediaC];
  const expectedLoserMedia = winner.entry.title === "competing A" ? [mediaC] : [mediaA, mediaB];
  const actualLinks = await d1.prepare("SELECT media_id FROM entry_media WHERE entry_id=?").bind(competingKey).all();
  assert.deepEqual(actualLinks.results.map(row => row.media_id).sort(), expectedWinnerMedia.sort());
  for (const mediaId of expectedLoserMedia) assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entry_media WHERE entry_id=? AND media_id=?").bind(competingKey, mediaId).first()).count, 0);

  const invalid = await post(worker, base("invalid key", "fixture"), "bad-key");
  assert.equal(invalid.status, 400);

  await mf.dispose(); mf = undefined;
  worker = await startWorker();
  d1 = await mf.getD1Database("DB");
  const afterRestart = await post(worker, input, key);
  assert.equal(afterRestart.status, 200);
  assert.equal((await afterRestart.json()).entry.id, key);
  const legacyOne = await post(worker, base("legacy fixture", "first"));
  const legacyTwo = await post(worker, base("legacy fixture", "second"));
  assert.equal(legacyOne.status, 201);
  assert.equal(legacyTwo.status, 201);
  assert.notEqual((await legacyOne.json()).entry.id, (await legacyTwo.json()).entry.id);
  assert.equal((await d1.prepare("SELECT COUNT(*) AS count FROM entries WHERE title='legacy fixture'").first()).count, 2);

  console.log("✓ isolated D1 create retry, conflict, concurrency, media-link integrity, restart replay, and legacy POST passed");
} finally {
  if (mf) await mf.dispose();
  if (ownsTemp) {
    const target = verifiedTempPath(tempRoot);
    const runtimeReal = await realpath(runtimeRoot);
    if (await realpath(path.dirname(target)) !== runtimeReal) throw new Error("Refusing cleanup after runtime path changed.");
    await rm(target, { recursive: true, force: false });
  }
}
