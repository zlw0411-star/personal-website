// 用真实的 Miniflare KV 运行时检验 lib/server/media-store.ts 的映射是否正确。
//
// 覆盖：绑定缺失时的空值、写入后字节一致、读回是流、缺失键返回 null、删除后读不到、
// 超限值被拒绝、Content-Type 元数据保留。使用独立临时状态目录，不接触网站正在使用的数据。
//
// 用法：node --experimental-strip-types scripts/verify-media-kv.mjs

import { randomBytes, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMediaStore } from "../lib/server/media-store.ts";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const stateDir = path.join(root, ".sites-runtime", `media-kv-${randomUUID()}`);
const namespaceId = randomUUID().replace(/-/gu, "");
const MAX_VALUE_BYTES = 25 * 1024 * 1024;

const checks = [];
const record = (ok, label) => { checks.push({ ok: Boolean(ok), label }); };
const sameBytes = (left, right) => {
  const a = new Uint8Array(left), b = new Uint8Array(right);
  return a.byteLength === b.byteLength && a.every((byte, index) => byte === b[index]);
};

const { Miniflare } = await import("miniflare");
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('media-kv-harness') } }",
  compatibility_date: "2026-05-15",
  kvNamespaces: { MEDIA: namespaceId },
  kvPersist: stateDir,
});

try {
  const namespace = await runtime.getKVNamespace("MEDIA");

  record(getMediaStore(undefined) === null, "绑定缺失时返回 null，媒体路由据此返回 404");
  const store = getMediaStore(namespace);
  record(store !== null, "绑定存在时返回可用存储");

  if (store) {
    const key = `${randomUUID()}.png`;
    const bytes = new Uint8Array(randomBytes(4096));
    await store.put(key, bytes, "image/png");

    const stream = await store.get(key);
    record(stream instanceof ReadableStream, "读回的是 ReadableStream（路由可直接交给 Response）");
    if (stream) {
      const roundTrip = new Uint8Array(await new Response(stream).arrayBuffer());
      record(sameBytes(bytes, roundTrip), "写入与读回字节完全一致");
    } else {
      record(false, "写入后能读回对象");
    }

    const { metadata } = await namespace.getWithMetadata(key, "stream");
    record(metadata?.contentType === "image/png", "Content-Type 元数据随对象保留");

    record((await store.get(`${randomUUID()}.png`)) === null, "不存在的键返回 null");

    await store.delete(key);
    record((await store.get(key)) === null, "删除后读不到对象");

    let rejected = false;
    try {
      await store.put(`${randomUUID()}.png`, new Uint8Array(MAX_VALUE_BYTES + 1), "image/png");
    } catch { rejected = true; }
    record(rejected, "超过单值上限的写入被拒绝，而不是交给 KV 报错");
  }
} finally {
  await runtime.dispose();
  await rm(stateDir, { recursive: true, force: true });
}

let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
  if (!check.ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} 项通过`);
process.exit(failed ? 1 : 0);
