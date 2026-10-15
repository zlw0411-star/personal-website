// 一次性搬迁脚本：把本地 .wrangler/state 里旧 R2 模拟存储中的图片，复制到同一状态目录
// 下的 KV 命名空间（绑定 MEDIA）。
//
// 背景：图片存储从 R2 改为 KV 后，新绑定读不到旧的 R2 对象。D1 的 media 表记录仍然指向
// 原来的 objectKey，所以只要把相同 key 的对象搬过去，正文与引用关系都不用改。
//
// 只读写本地状态目录，不连接任何云端资源。旧 R2 数据保留不删，便于回退。
//
// 用法：node scripts/migrate-local-media-to-kv.mjs

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
// Wrangler / 本地 dev 把 Miniflare 数据放在 <persist-to>/v3/<插件>/ 下。这里显式给出每个插件
// 的目录，与 wrangler 的布局逐段对齐；否则 Miniflare 会另建一套空存储，读不到现有数据。
const persistRoot = path.join(root, ".wrangler", "state", "v3");
const builtConfig = path.join(root, "dist", "server", "wrangler.json");

// 旧配置里的 R2 桶名（vite.config.ts 历史值），只用于读取遗留数据。
const LEGACY_R2_BUCKET = "site-creator-r2";

const fail = message => { console.error(`搬迁中止：${message}`); process.exit(1); };

let config;
try {
  config = JSON.parse(await readFile(builtConfig, "utf8"));
} catch (error) {
  fail(`读取 ${builtConfig} 失败，请先运行 \`npm run build\`。${error.code === "ENOENT" ? "" : ` (${error.message})`}`);
}

const databaseId = config.d1_databases?.[0]?.database_id;
const namespaceId = config.kv_namespaces?.[0]?.id;
if (!databaseId) fail("构建产物里没有 D1 绑定。");
if (!namespaceId) fail("构建产物里没有 KV 绑定，vite.config.ts 的 localBindingConfig 可能被改过。");

const { Miniflare } = await import("miniflare");
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('media-migration-harness') } }",
  compatibility_date: config.compatibility_date ?? "2026-05-15",
  compatibility_flags: config.compatibility_flags ?? [],
  d1Databases: { DB: databaseId },
  d1Persist: path.join(persistRoot, "d1"),
  r2Buckets: { LEGACY: LEGACY_R2_BUCKET },
  r2Persist: path.join(persistRoot, "r2"),
  kvNamespaces: { MEDIA: namespaceId },
  kvPersist: path.join(persistRoot, "kv"),
});

const copied = [], alreadyPresent = [], missing = [], failed = [];
try {
  const db = await runtime.getD1Database("DB");
  const legacy = await runtime.getR2Bucket("LEGACY");
  const kv = await runtime.getKVNamespace("MEDIA");

  const { results: rows } = await db.prepare("select id, object_key, mime_type, size from media order by created_at").all();
  console.log(`本地 media 记录：${rows.length} 条；持久化目录：${path.relative(root, persistRoot)}`);

  for (const row of rows) {
    const objectKey = row.object_key, mimeType = row.mime_type, size = row.size;
    try {
      const existing = await kv.get(objectKey, "arrayBuffer");
      if (existing && existing.byteLength === size) { alreadyPresent.push(objectKey); continue; }

      const object = await legacy.get(objectKey);
      if (!object) { missing.push(objectKey); continue; }

      const bytes = new Uint8Array(await object.arrayBuffer());
      await kv.put(objectKey, bytes, { metadata: { contentType: mimeType } });

      const roundTrip = await kv.get(objectKey, "arrayBuffer");
      if (!roundTrip || roundTrip.byteLength !== bytes.byteLength
          || !new Uint8Array(roundTrip).every((byte, index) => byte === bytes[index])) {
        failed.push(`${objectKey}（写入后读回字节不一致）`);
        continue;
      }
      copied.push(`${objectKey} (${bytes.byteLength} 字节)`);
    } catch (error) {
      failed.push(`${objectKey}（${error.message}）`);
    }
  }
} finally {
  await runtime.dispose();
}

for (const item of copied) console.log(`  已搬迁 ${item}`);
for (const item of alreadyPresent) console.log(`  已存在，跳过 ${item}`);
for (const item of missing) console.error(`  旧 R2 中找不到对象 ${item}`);
for (const item of failed) console.error(`  失败 ${item}`);

console.log(`\n小结：搬迁 ${copied.length}，跳过 ${alreadyPresent.length}，缺失 ${missing.length}，失败 ${failed.length}`);
if (missing.length || failed.length) process.exit(1);
console.log("本地图片已就绪：重新运行 `npm run dev` 后，原有图片应能正常显示。");
