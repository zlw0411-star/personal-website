# 作品集内容同步（2026-10-19）

项目介绍由 `lib/portfolio-data.ts` 维护，不会自动随 GitHub 提交更新。以下记录各项目最近一次核对的公开版本；首次同步时本地 HEAD 与远端一致，后续游戏更新直接对照远端固定提交的 README 和核心代码。

| 项目 | 核对版本 | 本次内容调整 |
| --- | --- | --- |
| 青禾校园卡管理系统 | [f1a1a06](https://github.com/zlw0411-star/campus-card-system/commit/f1a1a063deb353098ed45ae5cd245ba1f230d438) | 本轮只改 `tools.ps1`，未发现业务功能变化；原交易与账户边界保持 |
| 航空订票系统 | [076986b](https://github.com/zlw0411-star/air-ticket-system/commit/076986b6260376401431cf4e7371f0462c4741fd) | JWT 密钥改用外部配置；缺失或占位密钥时拒绝启动 |
| Java EE 餐饮点餐系统 | [aa9cd1a](https://github.com/zlw0411-star/java-ee/commit/aa9cd1afaaa50f955de574e68de4720ca6b45207) | 按当前代码补充外部令牌密钥配置；两服务缺少密钥时拒绝启动 |
| Desktop Pet | [d08f0d9](https://github.com/zlw0411-star/desktop-pet/commit/d08f0d97743c37bb4cf9eccd1fa7e15a0b792e5f) | 未变化：三页设置、专注模式、本地模板聊天、在线停止与重试 |
| 学习资料分析助手 | [4453453](https://github.com/zlw0411-star/cs-study-assistant/commit/44534535179e9fdad4d29ea203a29020e0574815) | 未变化：四格式导入、桌面/Web、离线目录与可选在线分析 |
| 余烬试炼 | [06bf3d6](https://github.com/zlw0411-star/emberfall-arena/commit/06bf3d6dd71304f654431173cb8c11e4255ed0d3) | 新增首领竞伤、四张地图与新技能；保留本地单人对局边界 |

## 核对依据

- 校园卡：`README.md`、`backend/.../ServiceFactory.java`、`web/src/stores/operations.ts`、`web/src/stores/auth.ts`。
- 订票：`backend/.../flight/FlightService.java`、`FlightInventoryMapper.java`、`order/OrderService.java`、`OrderTimeoutScheduler.java`。
- 餐饮：`services/order-service/.../OrderController.java`、`Repositories.java`、`ReportController.java`、`database/schema.sql`。
- 桌宠：`README.md`、`pet/settings_dialog.py`、`pet/personality.py`、`pet/app.py`、`pet/ai/client.py`。
- 学习助手：`README.md`、`study_assistant/materials.py`、`local_organization.py`、`analysis.py`、`desktop.py`、`desktop_jobs.py`。
- 游戏：`README.md`、`dist/js/{world,combat,simulation,ai,renderer,app,modes,controls,melee-vfx}.js`、`server.mjs`、`package.json`，以及近战、输入和视觉测试源码。

## 展示策略与边界

- 首页保持三个精选：校园卡、订票、学习助手。两个 Java 业务系统保留主位，新增成熟的桌面/Web 工具；机械臂仍在完整列表中。
- 六个已公开仓库显示 GitHub 链接。未公开的团队资料不读取、不上传，机械臂与报告平台原有参与范围保持不变。
- 不把测试脚本存在等同于测试通过，不宣称真实模型准确率、真实资金结算、网络多人或固定渲染帧率。
- 本次不修改数据库中的个人资料、文章、图片、管理员设置或密钥。首页个人介绍仍由原有 Profile 提供。
- 首页“查看全部项目”和详情返回链接沿用 `SiteLink` 普通锚点，规避固定 vinext 版本已记录的软导航故障。

## 首轮同步验证与发布

- `npm run verify:portfolio`：6/6 通过，覆盖唯一 slug、内容结构、六个公开仓库链接、精选一致性、学习工具与游戏范围、普通锚点约定。
- `npm run typecheck`、`npm run build` 通过。
- 用 Edge 无头浏览器分别检查独立内存 D1/KV 的 Miniflare 生产构建与线上站点：桌面首页到列表、全部八个详情和元数据、六个源码链接、返回列表、390px 手机无横向溢出及精选卡点击、未知项目和关闭管理页 404；未捕获未处理 JS 异常。隔离预览单独提供构建静态资源，确认 CSS 已加载后才检查布局。
- 通过既有 Cloudflare 发布流程上线，Worker 版本 `3de95f74-1dee-4704-90b4-b53c7ac8df5d`，地址 <https://aboutme.lingwei.workers.dev>。
- 浏览器检查只访问公开页面，未登录后台；未修改真实资料，未重新执行六个来源项目的业务测试。无头布局检查不等于真人多设备视觉验收。

## 游戏双模式补充同步（2026-10-16 晚间）

- 对照 [cdce84a → 2cf4a34](https://github.com/zlw0411-star/emberfall-arena/compare/cdce84a42c47efc3ccc7aaa5db70529b86eeece7...2cf4a3430a985424effc32b4cad490c254eeb2bc) 的两次提交及核心源码，更新游戏列表摘要、详情功能、实现思路和范围；slug、源码链接、技术栈与首页精选顺序不变。
- `modes.js` / `combat.js` 的 `getSkills`、`configureActorForMode` 按模式配置武器与技能池；`controls.js` 的 `createAttackInput` 保留短点击边沿并维护按住状态。
- `castMeleeSkill`、`tickMelee`、`hitMelee` 实现三刀技、动作阶段、扇形/视线检查与单动作命中去重；`thinkMelee` 增加近战 AI 决策。
- `melee-vfx.js` 将刀光、残影与战斗判定分离。文案不把视觉余效当成额外伤害、动作锁或无敌，也不宣称绝对墙体遮挡或完美 AI。
- 保留单人本地、键鼠操作、无网络联机等限制；说明重开沿用模式、刷新默认经典远程，不新增未经核验的在线试玩地址。
- 新增双模式与视觉/伤害边界的只读检查，`npm run verify:portfolio` 7/7、TypeScript、改动文件 ESLint 与生产构建通过。隔离生产构建和线上 Edge 检查均通过，并逐项核对全部八个详情的功能、实现和范围文案，包含 390px 手机无横向溢出、返回与卡片跳转；未捕获未处理 JS 异常。
- 已发布 <https://aboutme.lingwei.workers.dev/projects/emberfall-arena>，Worker 版本 `22b75433-58b5-4279-b92d-c9f7b1b64202`。
- 本次未运行游戏业务测试，测试源码存在不代表已通过；也未修改游戏仓库、网站数据库或个人资料。

## 默认分支核对与网站更新（2026-10-19）

- 校园卡仓库核对到 `f1a1a063deb353098ed45ae5cd245ba1f230d438`：提交仅调整 `tools.ps1`，未发现业务功能变化；保留已有交易恢复、账户与会话边界描述。
- 航空订票仓库核对到 `076986b6260376401431cf4e7371f0462c4741fd`：JWT 密钥改为外部配置，缺少密钥或仍使用占位值时拒绝启动。更新配置与启动边界，不新增业务功能描述。
- 餐饮点餐仓库核对到 `aa9cd1afaaa50f955de574e68de4720ca6b45207`：旧 SHA 比较请求返回 404，无法据此判断历史增量；按当前代码补充外部令牌密钥配置。`TokenUtil` 在密钥缺失时拒绝启动，`OrderController` 保留顾客身份与终态检查，`Repositories` 保留餐桌锁。证据见被忽略的只读核对记录 `.sites-runtime/project-refresh-2026-10-19/java/java-ee-current-code-check.md`。
- Desktop Pet (`d08f0d97743c37bb4cf9eccd1fa7e15a0b792e5f`) 与学习资料分析助手 (`44534535179e9fdad4d29ea203a29020e0574815`) 的默认分支 SHA 与上次记录相同；本轮重新核对日期，不扩写功能。
- 余烬试炼对照 [2cf4a34 → 06bf3d6](https://github.com/zlw0411-star/emberfall-arena/compare/2cf4a3430a985424effc32b4cad490c254eeb2bc...06bf3d6dd71304f654431173cb8c11e4255ed0d3) 与固定 HEAD 源码，补充首领竞伤、四张主题地图、闪电链/冰霜新星以及穿云刺/护体刀阵。首领模式按对首领造成的实际伤害排名，包含复活和结算；模式与技能整理到独立模块。仍为 12 人本地对局，不支持联网、账号、永久排行榜或存档。
- 游戏仓库的修复记录 `docs/FIXES-20261019.md` 报告 24 局首领模拟均运行至 600 秒、0 局击败首领；这是仓库记录，不代表首领平衡通过。本轮未运行游戏或来源项目业务测试。
- 作品集只读检查 7/7、TypeScript 检查、生产构建及本地 HTTP 检查 52/52 通过。线上同一 HTTP 脚本增加航空订票文案和四地图严格断言后 53/53 通过。CUA 实际点击验证了项目列表→余烬试炼详情→返回；桌面与 390px 视口下新游戏详情无横向溢出，控制台无错误。八个项目详情的覆盖是 HTTP 检查结果，不是逐页 CUA 浏览器遍历。
- 已发布 <https://aboutme.lingwei.workers.dev/projects/emberfall-arena>，Cloudflare Worker `aboutme` 版本 `91eb65d4-a9ee-4f33-a045-f7690e222bb3`。本轮仅更新作品集文案并执行既有检查；本地与线上 Profile hash 一致，未改真实数据库、图片或账号，也未运行来源项目业务测试。

## 后续更新

1. 检查仓库默认分支与公开状态，对照 README 和核心实现，不仅看 GitHub description。
2. 修改 `lib/portfolio-data.ts`；已有 slug 保持稳定，新增项目使用唯一 slug。
3. 执行 `npm run verify:portfolio`、`npm run typecheck`、`npm run build`。作品集检查只读，不连接数据库或外部服务。
4. 验证首页、项目列表、每个详情和源码链接，再按 `DEPLOY.md` 发布。代码推送 GitHub 本身不会自动部署当前 Worker。
