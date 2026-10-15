# 部署到 Cloudflare Workers

这是本站的推荐部署方式：构建产物本身就是 Cloudflare Worker，**不需要改任何代码**。
个人站用量远低于免费额度（Workers 10 万请求/天、D1 5GB、KV 1GB），费用为 0。

服务器不在中国大陆，**不需要 ICP 备案**。唯一短板是国内访问延迟偏高，且 `*.workers.dev`
默认域名在国内不稳定，建议后期绑一个自己的域名（约 ¥30/年）。

---

## 1. 前置条件

- Cloudflare 账号（免费注册）
- Node.js ≥ 22.13（本项目要求，本机已验证 v24.18.0）
- 仓库依赖已装好（`npm ci`）
- 可选：自己的域名

## 2. 一次性准备

### 2.1 登录 Cloudflare

在项目根目录执行，浏览器会打开授权页：

```powershell
npx wrangler login
```

验证：`npx wrangler whoami` 应列出你的账号。

### 2.2 创建 D1 数据库

```powershell
npx wrangler d1 create site-creator-d1
```

**记下输出里的 `database_id`**（UUID），下一步要用。

### 2.3 创建 KV 命名空间（存图片）

图片存储用的是 Workers KV，它包含在免费计划内，**不需要开通 R2，也不需要绑定支付方式**：

```powershell
npx wrangler kv namespace create MEDIA
```

**记下输出里的 `id`**（32 位十六进制），下一步要用。

> 为什么不用 R2：R2 虽然免费额度更大（10 GB vs KV 1 GB），但需要单独走一次结账流程并绑定
> 国际支付卡。KV 免费额度为 1 GB 存储、每天 10 万次读、1000 次写，个人站足够。
> 代码里两者被 [lib/server/media-store.ts](lib/server/media-store.ts) 这层适配隔开，
> 将来若换成 R2 或别的存储，只改这个文件。

### 2.4 写入部署参数

新建 `.env.deploy`（`.gitignore` 已忽略 `.env*`，不会被提交）：

```
CF_D1_DATABASE_ID=把 2.2 拿到的 UUID 填这里
CF_KV_NAMESPACE_ID=把 2.3 拿到的 32 位 ID 填这里
CF_WORKER_NAME=about-me-personal-website
```

> 为什么需要这一步：`npm run build` 生成的 `dist/server/wrangler.json` 里，D1 `database_id`
> 和 KV namespace `id` 都是 [vite.config.ts](vite.config.ts) 写死的占位符
> （`00000000-0000-4000-8000-000000000000` / `00000000000000000000000000000000`），
> **每次构建都会被重置**。所以真实 ID 不能手改那个文件，改由
> [scripts/deploy-cloudflare.mjs](scripts/deploy-cloudflare.mjs) 注入到
> `dist/server/wrangler.deploy.json`。

## 3. 建立数据表

```powershell
npm run build
npm run deploy:cf -- --prepare-only
npx wrangler d1 migrations apply site-creator-d1 --remote --config dist/server/wrangler.deploy.json
```

`--prepare-only` 只生成部署配置、不联网，可以先检查 `dist/server/wrangler.deploy.json`
里的 `database_id` 和 KV namespace `id` 是不是真的。

如果 `migrations apply` 不认迁移目录，改为逐文件执行（共 4 个文件，按编号顺序）：

```powershell
npx wrangler d1 execute site-creator-d1 --remote --file drizzle/0000_moaning_kree.sql
# 再依次执行 0001 / 0002 / 0003
```

## 4. 部署

```powershell
npm run build
npm run deploy:cf
```

成功后会输出形如 `https://about-me-personal-website.<你的账号子域>.workers.dev` 的地址。
**此时公开页面已经可以访问**，管理后台仍是关闭状态（生产默认关闭）。

## 5. 绑定自己的域名（推荐）

1. Cloudflare 控制台 → 添加站点，把你的域名 NS 改到 Cloudflare
2. Workers & Pages → 选中该 Worker → Settings → Domains & Routes → Add → Custom Domain
3. 填域名，等待证书签发（通常几分钟）

## 6. 打开管理后台（可选）

管理功能在生产环境默认关闭，需要显式设置三个服务端变量（用 secret，不要写进 `vars` 或仓库）：

```powershell
npx wrangler secret put SITE_ADMIN_ENABLED    # 输入 true
npx wrangler secret put SITE_ORIGIN           # 输入 https://你的域名
npx wrangler secret put SITE_INITIAL_SECURITY # 首次初始化用的带盐密码哈希记录
```

注意事项：

- `SITE_ORIGIN` 必须是**精确 origin**：含协议、不带路径、不带结尾斜杠，且与实际访问地址完全一致，否则管理 API 会被拒绝。
- `SITE_INITIAL_SECURITY` 只在 security 表为空时写入一次，之后不会覆盖已有管理员密码。
- 不设置这三个变量 = 公开页面正常，`/admin` 与全部管理 API 返回 404（这是设计行为，不是故障）。

## 7. 迁移本地内容

本地数据在 `.wrangler/state/`，公网库是空的。**源码备份不能恢复内容**，必须走管理员 API 导入：

```powershell
# 1) 另开一个终端，保持本地开发服务器运行
npm run dev

# 2) 回到本终端执行迁移（在 127.0.0.1:5173 与目标站之间同步）
'{"password":"你的管理员密码","targetOrigin":"https://你的域名"}' | node scripts/migrate-local-to-site.mjs
```

脚本要求目标是 HTTPS、且 origin 与本地源不同。密码含非 ASCII 字符时，注意 PowerShell
管道的编码（可先用纯 ASCII 密码测试一次）。

> 图片存储从 R2 换成 KV 后，旧的本地 R2 对象不会被新绑定读取。如果本地站点的图片显示不出来，
> 运行一次搬迁脚本即可（只读写本地 `.wrangler/state/`，不联网）：
>
> ```powershell
> node scripts/migrate-local-media-to-kv.mjs
> ```

## 8. 验收清单

- [ ] 首页 / 关于 / 项目页返回 200，样式与图片正常
- [ ] 站内导航、手机端布局正常
- [ ] `/admin` 返回 404（未开管理）或能正常登录（已开管理）
- [ ] 修改一篇文章后刷新，内容持久化（D1 生效）
- [ ] 上传一张图片后刷新，图片仍在（KV 生效；注意上传后其他地区最长约 60 秒可见）
- [ ] 用手机流量（非 WiFi）访问一次，确认可访问

## 9. 更新与回滚

| 操作 | 做法 |
|---|---|
| 发布新版本 | `npm run build` 然后 `npm run deploy:cf` |
| 回滚代码 | Cloudflare 控制台 → Worker → Deployments → 选历史版本 → Rollback |
| 备份数据库 | `npx wrangler d1 export site-creator-d1 --remote --output backup.sql` |
| 备份图片 | 控制台 Workers & Pages → KV → 选中命名空间 → 查看/导出键值 |
| 本地内容备份 | 停止服务器后整份复制 `.wrangler/state/` |

## 10. 常见坑

1. **构建后 D1 ID 又变回占位符** —— 正常，永远用 `npm run deploy:cf` 部署，别手改 `dist/server/wrangler.json`。
2. **`workers.dev` 在国内打不开** —— 换绑自己的域名，别用默认域名对外。
3. **KV 命名空间 ID 写错** —— 必须是 32 位十六进制；`npm run deploy:cf` 会先校验格式再部署。
4. **管理页 403/502** —— 检查 `SITE_ORIGIN` 是否与实际访问的 origin 完全一致。
5. **部署报找不到 `dist/server/wrangler.json`** —— 忘了先 `npm run build`。
6. **不要把 `.env.deploy`、`.wrangler/state/`、密码或哈希记录提交到 Git。**
7. **公开页面的「管理内容」入口始终显示**，真正的权限由服务端 gate + 管理员认证控制，这是预期行为。

---

## 备选方案：部署到自己的服务器（不建议）

本站强绑定 Workers 运行时，直接部署到普通服务器**跑不起来**，需要先改造：

| 现状 | 需替换为 |
|---|---|
| D1（`drizzle-orm/d1`） | `drizzle-orm/better-sqlite3` 或 MySQL |
| KV（`MEDIA` 绑定） | 阿里云 OSS / 本地磁盘 + 静态路由 |
| `import { env } from "cloudflare:workers"` | 进程环境变量 |
| vinext + `@cloudflare/vite-plugin` + `build/sites-*` | 标准 Next.js `next build` + `next start` |
| — | Nginx 反代 + certbot HTTPS + pm2/systemd 守护 + 定时备份 |

工作量约 1~3 天，且国内服务器 + 域名需要 ICP 备案。只为个人站的话不建议走这条路。
