import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const runtimeRoot = path.resolve(root, ".sites-runtime");
const tempName = `profile-storage-${randomUUID()}`;
const tempRoot = path.resolve(runtimeRoot, tempName);
const dbPath = path.join(tempRoot, "d1");
const workerPath = path.join(tempRoot, "worker.mjs");
const expectedPrefix = `${runtimeRoot}${path.sep}`;
let ownedTempDirectory = false;
let mf;

const fixture = {
  siteName: "Profile Storage Fixture",
  nickname: "Fixture Person",
  bio: "This is temporary isolated verification content.",
  about: "An isolated D1 fixture.",
  experience: "Fixture experience.",
  avatarId: null,
  email: "legacy@example.test",
  links: [{ label: "Legacy site", url: "https://legacy.example.test/profile" }],
  contacts: [
    { kind: "email", label: "Work email", value: "work@example.test" },
    { kind: "phone", label: "Phone", value: "+1 (555) 012-3456" },
    { kind: "link", label: "Portfolio", value: "https://example.test/portfolio" },
    { kind: "text", label: "Other", value: "Signal: fixture-handle" },
  ],
};

const harness = `
import { getProfile, upsertProfile } from "@/lib/server/content";
export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/profile") return Response.json(await getProfile());
      if (request.method === "POST" && url.pathname === "/profile") return Response.json(await upsertProfile(await request.json()));
      return new Response("Not found", { status: 404 });
    } catch {
      return Response.json({ error: "isolated profile storage operation failed" }, { status: 500 });
    }
  },
};
`;

async function startWorker() {
  mf = new Miniflare({
    scriptPath: workerPath,
    modules: true,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: "profile-storage-fixture" },
    d1Persist: dbPath,
  });
  return mf.getWorker();
}

async function call(worker, pathName, init) {
  const response = await worker.fetch(`http://profile-storage.test${pathName}`, init);
  if (!response.ok) throw new Error(`Isolated worker returned HTTP ${response.status}.`);
  return response.json();
}

function assertInsideRuntime(candidate) {
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(expectedPrefix) || path.basename(resolved) !== tempName || !/^profile-storage-[0-9a-f-]{36}$/i.test(path.basename(resolved))) {
    throw new Error("Refusing to remove a path outside this script's verified temporary directory.");
  }
  return resolved;
}

try {
  await mkdir(runtimeRoot, { recursive: true });
  const runtimeReal = await realpath(runtimeRoot);
  const tempResolved = assertInsideRuntime(tempRoot);
  if (!tempResolved.startsWith(`${runtimeReal}${path.sep}`)) throw new Error("Temporary directory is outside the resolved runtime directory.");
  await mkdir(tempResolved, { recursive: false });
  ownedTempDirectory = true;

  await build({
    stdin: { contents: harness, resolveDir: root, sourcefile: "profile-storage-harness.ts", loader: "ts" },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    tsconfig: path.join(root, "tsconfig.json"),
    external: ["cloudflare:workers"],
    outfile: workerPath,
    logLevel: "silent",
  });

  const migrationDir = path.join(root, "drizzle");
  const migrationNames = (await readdir(migrationDir)).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
  if (!migrationNames.length) throw new Error("No Drizzle migrations found.");

  mf = new Miniflare({
    scriptPath: workerPath,
    modules: true,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: "profile-storage-fixture" },
    d1Persist: dbPath,
  });
  const d1 = await mf.getD1Database("DB");
  for (const name of migrationNames) {
    const sql = (await readFile(path.join(migrationDir, name), "utf8")).replace(/--> statement-breakpoint/g, "");
    for (const statement of sql.split(";").map((item) => item.trim()).filter(Boolean)) await d1.prepare(statement).run();
  }
  let worker = await mf.getWorker();

  const initial = await call(worker, "/profile");
  assert.deepEqual(initial.contacts, [], "empty D1 profile exposes an empty contacts array");
  const firstWrite = await call(worker, "/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fixture) });
  assert.deepEqual(firstWrite, fixture, "upsert returns all four contacts and legacy fields");
  assert.deepEqual(await call(worker, "/profile"), fixture, "GET roundtrip preserves contacts and legacy fields");

  const updated = { ...fixture, nickname: "Fixture Person Updated", contacts: fixture.contacts.map((contact, index) => index === 3 ? { ...contact, value: "Updated fixture note" } : contact) };
  await call(worker, "/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
  assert.deepEqual(await call(worker, "/profile"), updated, "second upsert updates existing profile values");

  await mf.dispose();
  mf = undefined;
  worker = await startWorker();
  assert.deepEqual(await call(worker, "/profile"), updated, "isolated D1 profile survives Miniflare restart");
  const cleared = { ...updated, contacts: [] };
  await call(worker, "/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cleared) });
  assert.deepEqual((await call(worker, "/profile")).contacts, [], "explicit empty contacts array clears stored contacts");

  console.log("✓ isolated profile D1 roundtrip, update, restart persistence, and contact clearing passed");
} finally {
  if (mf) await mf.dispose();
  if (ownedTempDirectory) {
    const target = assertInsideRuntime(tempRoot);
    const runtimeReal = await realpath(runtimeRoot);
    const targetParent = await realpath(path.dirname(target));
    if (targetParent !== runtimeReal) throw new Error("Refusing to remove temporary data after runtime path changed.");
    await rm(target, { recursive: true, force: false });
  }
}
