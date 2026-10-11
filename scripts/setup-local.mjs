import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const generatedConfig = path.join(projectRoot, "dist", "server", "wrangler.json");
const runtimeDir = path.join(projectRoot, ".sites-runtime");
const localConfig = path.join(runtimeDir, "local-migrations.json");
const persistedState = path.join(projectRoot, ".wrangler", "state");
const wranglerCli = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");

async function exists(file) {
  try { await readFile(file); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

if (!await exists(generatedConfig)) {
  const build = spawnSync(process.execPath, [path.join(projectRoot, "scripts", "run-framework.mjs"), "build"], { cwd: projectRoot, stdio: "inherit" });
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const generated = JSON.parse(await readFile(generatedConfig, "utf8"));
const sourceDb = generated.d1_databases?.find((binding) => binding.binding === "DB");
if (!sourceDb?.database_name || !sourceDb?.database_id) {
  throw new Error(`Generated worker config has no complete DB binding: ${generatedConfig}`);
}

await mkdir(runtimeDir, { recursive: true });
const config = {
  name: generated.name ?? generated.topLevelName ?? "local-personal-website",
  compatibility_date: generated.compatibility_date,
  compatibility_flags: generated.compatibility_flags ?? [],
  d1_databases: [{
    binding: "DB",
    database_name: sourceDb.database_name,
    database_id: sourceDb.database_id,
    migrations_dir: path.join(projectRoot, "drizzle"),
  }],
};
await writeFile(localConfig, `${JSON.stringify(config, null, 2)}\n`, "utf8");

const apply = spawnSync(process.execPath, [
  wranglerCli, "d1", "migrations", "apply", "DB", "--local", "--config", localConfig,
  "--persist-to", persistedState,
], { cwd: projectRoot, stdio: ["ignore", "inherit", "inherit"] });
if (apply.error) throw apply.error;
process.exit(apply.status ?? 1);
