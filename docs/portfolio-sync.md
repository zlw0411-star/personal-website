# 作品集内容同步（2026-10-16）

项目介绍由 `lib/portfolio-data.ts` 维护，不会自动随 GitHub 提交更新。本次核对了 GitHub 默认分支、README 和核心代码；以下六个仓库均为公开仓库，本地 HEAD 与远端一致。

| 项目 | 核对版本 | 本次内容调整 |
| --- | --- | --- |
| 青禾校园卡管理系统 | [a3f0985](https://github.com/zlw0411-star/campus-card-system/commit/a3f098564a84985bf035d573f1e50c66987dea9b) | 待确认交易、退出恢复、账户启停；限定同标签页恢复条件 |
| 航空订票系统 | [d2c11ff](https://github.com/zlw0411-star/air-ticket-system/commit/d2c11ff50226194267e26056ea4347407a72efbc) | 容量与价格编辑锁、已占用座位保护；区分后台查询与订单编辑 |
| Java EE 餐饮点餐系统 | [7249236](https://github.com/zlw0411-star/java-ee/commit/7249236f1179c681484b1bdc1b1b60127969717c) | 顾客身份绑定、订单状态检查，收窄同桌合单与并发保证表述 |
| Desktop Pet | [d08f0d9](https://github.com/zlw0411-star/desktop-pet/commit/d08f0d97743c37bb4cf9eccd1fa7e15a0b792e5f) | 三页设置、专注模式、本地模板聊天、在线停止与重试 |
| 学习资料分析助手 | [4453453](https://github.com/zlw0411-star/cs-study-assistant/commit/44534535179e9fdad4d29ea203a29020e0574815) | 替换旧 408 定位；四格式导入、桌面/Web、离线目录与可选在线分析 |
| 余烬试炼 | [cdce84a](https://github.com/zlw0411-star/emberfall-arena/commit/cdce84a42c47efc3ccc7aaa5db70529b86eeece7) | 新增案例；明确 1 真人 + 11 本地 AI，不是网络多人联机 |

## 核对依据

- 校园卡：`README.md`、`backend/.../ServiceFactory.java`、`web/src/stores/operations.ts`、`web/src/stores/auth.ts`。
- 订票：`backend/.../flight/FlightService.java`、`FlightInventoryMapper.java`、`order/OrderService.java`、`OrderTimeoutScheduler.java`。
- 餐饮：`services/order-service/.../OrderController.java`、`Repositories.java`、`ReportController.java`、`database/schema.sql`。
- 桌宠：`README.md`、`pet/settings_dialog.py`、`pet/personality.py`、`pet/app.py`、`pet/ai/client.py`。
- 学习助手：`README.md`、`study_assistant/materials.py`、`local_organization.py`、`analysis.py`、`desktop.py`、`desktop_jobs.py`。
- 游戏：`README.md`、`dist/js/{world,combat,simulation,ai,renderer,app}.js`、`server.mjs`、`package.json`。

## 展示策略与边界

- 首页保持三个精选：校园卡、订票、学习助手。两个 Java 业务系统保留主位，新增成熟的桌面/Web 工具；机械臂仍在完整列表中。
- 六个已公开仓库显示 GitHub 链接。未公开的团队资料不读取、不上传，机械臂与报告平台原有参与范围保持不变。
- 不把测试脚本存在等同于测试通过，不宣称真实模型准确率、真实资金结算、网络多人或固定渲染帧率。
- 本次不修改数据库中的个人资料、文章、图片、管理员设置或密钥。首页个人介绍仍由原有 Profile 提供。
- 首页“查看全部项目”和详情返回链接沿用 `SiteLink` 普通锚点，规避固定 vinext 版本已记录的软导航故障。

## 本次验证与发布

- `npm run verify:portfolio`：6/6 通过，覆盖唯一 slug、内容结构、六个公开仓库链接、精选一致性、学习工具与游戏范围、普通锚点约定。
- `npm run typecheck`、`npm run build` 通过。
- 用 Edge 无头浏览器分别检查独立内存 D1/KV 的 Miniflare 生产构建与线上站点：桌面首页到列表、全部八个详情和元数据、六个源码链接、返回列表、390px 手机无横向溢出及精选卡点击、未知项目和关闭管理页 404；未捕获未处理 JS 异常。隔离预览单独提供构建静态资源，确认 CSS 已加载后才检查布局。
- 通过既有 Cloudflare 发布流程上线，Worker 版本 `3de95f74-1dee-4704-90b4-b53c7ac8df5d`，地址 <https://aboutme.lingwei.workers.dev>。
- 浏览器检查只访问公开页面，未登录后台；未修改真实资料，未重新执行六个来源项目的业务测试。无头布局检查不等于真人多设备视觉验收。

## 后续更新

1. 检查仓库默认分支与公开状态，对照 README 和核心实现，不仅看 GitHub description。
2. 修改 `lib/portfolio-data.ts`；已有 slug 保持稳定，新增项目使用唯一 slug。
3. 执行 `npm run verify:portfolio`、`npm run typecheck`、`npm run build`。作品集检查只读，不连接数据库或外部服务。
4. 验证首页、项目列表、每个详情和源码链接，再按 `DEPLOY.md` 发布。代码推送 GitHub 本身不会自动部署当前 Worker。
