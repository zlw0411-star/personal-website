// 把 dist 的 Workers 构建产物部署到 Cloudflare。
//
// 背景：`npm run build` 生成的 dist/server/wrangler.json 里，D1 database_id 和 KV
// namespace id 都是 vite.config.ts 写死的占位符（00000000-0000-4000-8000-000000000000
// / 00000000000000000000000000000000），每次构建都会被覆盖。所以真实资源 ID 不能手改
// 那个文件，改为在这里注入到一个独立的 dist/server/wrangler.deploy.json 再交给 wrangler。
//
// 用法：
//   node scripts/deploy-cloudflare.mjs --prepare-only   # 只生成部署配置，不联网
//   node scripts/deploy-cloudflare.mjs                  # 生成配置并执行 wrangler deploy
//
// 配置来源（先读 .env.deploy，再让真实环境变量覆盖同名项）：
//   CF_D1_DATABASE_ID   必填，wrangler d1 create 得到的 UUID
//   CF_D1_NAME          可选，默认沿用构建产物里的 site-creator-d1
//   CF_KV_NAMESPACE_ID  必填，wrangler kv namespace create 得到的 32 位十六进制 ID
//   CF_WORKER_NAME      可选，默认沿用构建产物里的 about-me-personal-website

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE = new URL("../dist/server/wrangler.json", import.meta.url);
const TARGET = new URL("../dist/server/wrangler.deploy.json", import.meta.url);
const PLACEHOLDER = "00000000-0000-4000-8000-000000000000";
const NAMESPACE_PLACEHOLDER = "00000000000000000000000000000000";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAMESPACE_ID = /^[0-9a-f]{32}$/i;
const prepareOnly = process.argv.includes("--prepare-only");

function loadEnvFile() {
  const path = new URL("../.env.deploy", import.meta.url);
  if (!existsSync(path)) return {};
  const values = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`.env.deploy 无法解析这一行：${line}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function fail(message) {
  console.error(`部署中止：${message}`);
  process.exit(1);
}

if (!existsSync(SOURCE)) {
  fail("找不到 dist/server/wrangler.json，请先运行 `npm run build`。");
}

const env = { ...loadEnvFile(), ...process.env };
const databaseId = env.CF_D1_DATABASE_ID;
const namespaceId = env.CF_KV_NAMESPACE_ID;

if (!databaseId || databaseId === PLACEHOLDER) {
  fail(`缺少真实的 CF_D1_DATABASE_ID（先运行 wrangler d1 create，再把返回的 UUID 写入 .env.deploy）。`);
}
if (!UUID.test(databaseId)) {
  fail(`CF_D1_DATABASE_ID 不是合法 UUID：${databaseId}`);
}
if (!namespaceId || namespaceId === NAMESPACE_PLACEHOLDER) {
  fail("缺少真实的 CF_KV_NAMESPACE_ID（先运行 wrangler kv namespace create MEDIA，再把返回的 id 写入 .env.deploy）。");
}
if (!NAMESPACE_ID.test(namespaceId)) {
  fail(`CF_KV_NAMESPACE_ID 不是合法命名空间 ID（应为 32 位十六进制）：${namespaceId}`);
}

const config = JSON.parse(readFileSync(SOURCE, "utf8"));
const database = config.d1_databases?.[0];
const namespace = config.kv_namespaces?.[0];

if (!database || !namespace) {
  fail("构建产物里没有 D1 或 KV 绑定，vite.config.ts 的 localBindingConfig 可能被改过。");
}

database.database_id = databaseId;
database.database_name = env.CF_D1_NAME || database.database_name;
// 让 `wrangler d1 migrations apply` 找到 drizzle 迁移（构建时被复制到 dist/.openai/drizzle）。
database.migrations_dir = "../.openai/drizzle";
namespace.id = namespaceId;

const workerName = env.CF_WORKER_NAME || config.name;
config.name = workerName;
if (config.topLevelName) config.topLevelName = workerName;

writeFileSync(TARGET, `${JSON.stringify(config, null, 2)}\n`);

console.log(`已生成部署配置：dist/server/wrangler.deploy.json`);
console.log(`  Worker   : ${workerName}`);
console.log(`  D1       : ${database.database_name} (${databaseId})`);
console.log(`  KV       : ${namespace.binding} (${namespaceId})`);
console.log(`  迁移目录 : dist/.openai/drizzle`);

if (prepareOnly) {
  console.log("\n--prepare-only：未执行部署。");
  process.exit(0);
}

const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
if (!existsSync(wrangler)) fail("找不到本地 wrangler，请先运行 `npm ci`。");

console.log("\n执行 wrangler deploy ...\n");
const result = spawnSync(
  process.execPath,
  [wrangler, "deploy", "--config", fileURLToPath(TARGET)],
  { cwd: ROOT, stdio: "inherit" },
);
if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);
