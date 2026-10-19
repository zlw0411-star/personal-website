export type PortfolioProject = {
  slug: string;
  stage: PortfolioStage;
  title: string;
  kind: string;
  period: string;
  summary: string;
  background?: string;
  role?: string;
  stack: string[];
  features?: string[];
  implementation?: { title: string; description: string }[];
  limitations?: string[];
  highlights: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  sourceVisibility?: "public" | "private";
  featured?: boolean;
  note?: string;
};

export type PortfolioStage = "university" | "internship" | "work";

export const PORTFOLIO_STAGES: { id: PortfolioStage; label: string }[] = [
  { id: "university", label: "大学期间" },
  { id: "internship", label: "实习期间" },
  { id: "work", label: "工作期间" },
];

export const PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    slug: "atlas-power-robot-arm",
    stage: "university",
    title: "基于 Atlas 200DK 的智能机械臂电力运维",
    kind: "电力智能系统综合实践 · 团队课程项目",
    period: "2026",
    summary: "面向课程演示场景，将视觉识别结果映射到机械臂坐标，并接入语音指令控制。",
    background: "上海电力大学《电力智能系统综合实践》第 8 题，四人小组围绕电力运维场景完成的课程演示。系统运行在 Atlas 200I DK A2 开发板上，结合 ROS2 机械臂控制、视觉识别与语音交互。",
    role: "主要负责视觉感知与 AI 识别模块：相机标定、ROI 与透视变换、YOLOv5/.om 推理、像素坐标到世界坐标映射，以及语音指令接入。",
    stack: ["Atlas 200I DK A2", "YOLOv5", "OpenCV", "ROS2", "MiMo"],
    features: ["识别场景中的目标并输出检测结果。", "将目标像素位置换算为机械臂使用的世界坐标。", "接入抓取、连续抓取、停止和回位等语音命令。"],
    implementation: [
      { title: "视觉预处理与推理", description: "完成相机标定、ROI 裁剪和透视变换，并使用 YOLOv5 及 .om 模型进行目标识别。" },
      { title: "坐标映射", description: "把图像中的像素坐标转换到机械臂工作坐标，供 ROS2 控制链路使用。" },
      { title: "语音接入", description: "将 MiMo 语音识别结果映射为机械臂控制指令。" },
    ],
    limitations: ["这是课程团队的场景演示，未用于真实电力现场。源码未保留，无法复现或独立核验运行指标。"],
    highlights: ["实现目标识别、像素到世界坐标映射及语音指令接入的演示流程。"],
    note: "课程团队项目 · 源码未保留",
  },
  {
    slug: "campus-card-system",
    stage: "university",
    title: "青禾校园卡管理系统",
    kind: "课程设计 · Web 全栈项目",
    period: "2026",
    summary: "基于 Vue 3、TypeScript、Spring Boot 4.1.1 与 MySQL 的校园卡 Web 系统，支持模拟充值消费、交易查询与导出、管理员账户维护及待确认交易恢复。",
    background: "项目围绕校园卡日常使用场景，串联余额查询、模拟充值与消费、交易记录查询和导出，并处理网络异常时的交易确认与退出恢复。",
    features: ["查询账户余额、交易趋势和流水，导出 CSV。", "进行模拟充值与消费，按原操作编号查询或重试待确认交易。", "管理员开户、维护资料、启停账户并查看统计。", "退出失败时保留待确认提示，刷新后可重试安全退出。"],
    implementation: [
      { title: "金额与并发一致性", description: "金额使用 BigDecimal；充值和消费通过事务、账户与卡锁、唯一操作号约束重复请求及并发更新。" },
      { title: "待确认交易恢复", description: "请求结果不确定时先查询结果，再沿用原操作号重试。待确认请求保存在 sessionStorage，同一标签页刷新后核对用户归属与会话再恢复；存储不可用时阻止交易提交。" },
      { title: "会话与退出确认", description: "采用同源 HttpOnly Session 和 CSRF 防护；保留退出意图，隔离旧会话的异步响应，退出或会话失效后清除待确认交易。" },
      { title: "测试与交付", description: "提供接口测试、Vitest 与 Playwright 测试代码，以及使用隔离 MySQL 的 GitHub Actions 工作流。" },
    ],
    limitations: ["充值和消费是系统内模拟操作，不涉及真实资金或校园卡服务。", "交易恢复依赖同一标签页的浏览器存储和有效会话，不是跨设备恢复；会话使用单进程内存存储。"],
    stack: ["Java 17", "Spring Boot 4.1.1", "Spring Security", "JDBC", "MySQL 8", "Vue 3", "TypeScript", "Pinia", "Vitest", "Playwright"],
    highlights: [
      "通过 BigDecimal、事务锁与唯一操作号处理模拟充值和消费。",
      "待确认交易按原操作号查询和重试，同标签页刷新后可恢复。",
      "提供退出失败确认、会话响应隔离与 CSRF 防护。",
      "包含接口、前端和浏览器测试及隔离 MySQL 的 CI 工作流。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/campus-card-system",
    sourceLabel: "GitHub",
    sourceVisibility: "public",
    featured: true,
  },
  {
    slug: "desktop-pet",
    stage: "university",
    title: "Desktop Pet",
    kind: "个人项目 · 桌面应用",
    period: "2026",
    summary: "基于 Python 与 PySide6 的 Windows 桌面陪伴宠物，支持动作互动、形象定制、本地趣味聊天、专注模式及可选 AI 流式对话。",
    background: "个人桌面应用项目，在 Windows 桌面提供可互动的宠物窗口，同时让外观预览、主动搭话和在线聊天保持可配置、可关闭。",
    features: ["支持摸头、拖拽投掷、跳舞、走向鼠标及坐在窗口上。", "提供形象、行为、聊天三页设置，预览四种内置形象或自定义图片/GIF，保存后应用。", "无需 AI 即可使用本地指令与模板聊天；专注模式减少走动并停止主动搭话。", "可选 AI 流式对话，支持停止生成、原轮失败重试、复制与清空记录。"],
    implementation: [
      { title: "桌面动作与状态机", description: "使用 PySide6 窗口与状态机管理动作，结合 Win32 API 实现坐在目标窗口上并跟随窗口位置。" },
      { title: "动画与资源占用", description: "可设置 10–60 FPS 上限；待机、睡眠时降帧，隐藏时暂停动画与 GIF。图片缩放和描边结果按内容缓存。" },
      { title: "本地与在线聊天", description: "优先处理本地指令；未配置 AI 时使用关键词和模板回复。在线对话使用可配置服务与备用模型，密钥从环境变量读取。" },
      { title: "素材预览与可选抠图", description: "候选图片只在保存后导入和应用；可选 rembg 在后台处理静态图片，GIF 保留动画、不执行静态抠图。" },
    ],
    limitations: ["面向 Windows，依赖 Win32 API；真实多屏和混合 DPI 体验仍需人工验证。", "离线聊天是关键词与模板回复，不是本地大模型；AI 需自行配置服务和密钥。聊天记录仅保留本次运行的最近 20 轮。"],
    stack: ["Python", "PySide6", "Qt Network", "Win32 API", "unittest"],
    highlights: [
      "以状态机组织桌面动作，支持窗口跟随与自定义动画素材。",
      "提供三页设置预览、专注模式和无需模型的本地聊天。",
      "在线聊天支持停止与重试，动画按状态降帧并缓存图片处理结果。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/desktop-pet",
    sourceLabel: "GitHub",
    sourceVisibility: "public",
    featured: false,
  },
  {
    slug: "java-ee-ordering",
    stage: "university",
    title: "Java EE 餐饮点餐系统",
    kind: "课程设计 · 微服务实践",
    period: "2026",
    summary: "面向课程演示的三角色餐饮点餐系统，拆分用户与订单服务，通过 Nacos 与 OpenFeign 查询会员折扣，覆盖点餐、结账、后台维护及营收报表。",
    background: "课程设计项目，以餐饮门店点餐与结账为业务场景，按用户和订单领域拆分后端服务。",
    features: ["顾客自助点餐并查看本人订单，服务员选桌代点、加菜、提交和结账。", "管理员维护菜品、餐桌、用户和会员等级，并查看营收与热门菜品报表。", "创建订单时占用餐桌，提交后进入待结账状态，结账或取消后释放餐桌。"],
    implementation: [
      { title: "服务发现与会员折扣", description: "user-service 与 order-service 分开部署；订单服务通过 Nacos 发现用户服务，再用 OpenFeign 查询会员折扣。折扣服务查询失败时回退原价。两服务的令牌签名密钥通过环境配置，缺失时启动失败。" },
      { title: "同桌订单与身份绑定", description: "创建订单时使用餐桌悲观锁，串行检查有效订单。顾客可复用本人订单或认领未绑定顾客的订单，其他顾客冲突请求被拒绝；服务员通过已有订单加菜。" },
      { title: "订单状态检查", description: "校验下单顾客身份与提交、结账、取消的状态流转，拒绝已结束订单重复结账或取消，避免错误释放已复用餐桌。" },
      { title: "数据库业务对象", description: "使用 Spring Data JPA 持久化，并提供订单明细视图、报表存储过程和餐桌占用/释放触发器脚本。" },
    ],
    limitations: ["这是课程实践项目，结账为系统内部状态变更，未接真实支付或门店运营。", "状态检查不等于完整的订单生命周期并发安全；已结账订单的菜品明细修改保护仍需完善。"],
    stack: ["Java 17", "Spring Boot 3.2.5", "Spring Cloud Alibaba", "Nacos", "OpenFeign", "Spring Data JPA", "Vue 3", "Element Plus", "MySQL 8"],
    highlights: [
      "拆分用户与订单服务，使用 Nacos 和 OpenFeign 查询会员折扣。",
      "以餐桌悲观锁串行检查创建请求，校验顾客身份和终态流转。",
      "提供营收报表及视图、存储过程、触发器脚本。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/java-ee",
    sourceLabel: "GitHub",
    sourceVisibility: "public",
  },
  {
    slug: "cs-study-assistant",
    stage: "university",
    title: "学习资料分析助手",
    kind: "个人项目 · 桌面与 Web 工具",
    period: "2026",
    summary: "支持 PDF、DOCX、TXT 与 Markdown 的学习资料工具，提供桌面端与网页端；桌面端可离线生成结构目录，按需在线整理摘要、大纲和知识点，并定位来源原文。",
    background: "从 408 真题学习台扩展为通用资料分析工具，提供 PySide6 原生 Windows 桌面端与 Streamlit 网页端，共享资料服务和 SQLite 存储；旧版真题入口独立保留。",
    features: ["导入四类文档，保留页码或段落来源，识别重复文件。", "桌面端无需模型即可生成规则目录，点击节点定位提取原文。", "显式发起在线智能整理后生成摘要、分层大纲、知识点和学习建议，支持来源核对。", "桌面端分别查看本地与智能结果，导出 Markdown / JSON；切换模式不联网。"],
    implementation: [
      { title: "共享资料服务", description: "统一处理文件提取、SHA-256 去重与 SQLite 持久化，保留原文件、提取文字和报告，供桌面端与网页端复用。" },
      { title: "本地与智能双层整理", description: "本地识别明确标题，无可靠标题时退回按页或段落导航；本地结果从已保存原文重建，不覆盖智能报告。" },
      { title: "分批分析与来源约束", description: "使用 OpenAI 兼容接口分批分析长资料并多级归并，校验来源编号、处理覆盖和报告结构；来源有效不代表内容正确或语义完整。" },
      { title: "桌面后台任务", description: "使用 QThread 执行导入与分析，提供进度和协作式取消，通过分层大纲及来源跳转辅助人工核对。" },
    ],
    limitations: ["不做 OCR、考试评分或答案核验；复杂公式、图像和表格布局可能丢失。每份资料独立整理，不跨文件综合。", "本地目录不是语义摘要。在线分析会将全部提取文字分批发送到所配置的服务，可能计费，需确认资料权限并人工核对结果。", "单文件限制为 20 MB、60 万字符和 300 个来源片段；模拟服务与离屏测试不代表真实模型准确率。"],
    stack: ["Python", "PySide6", "Streamlit", "SQLite", "pypdf", "HTTPX", "OpenAI 兼容接口"],
    highlights: [
      "桌面端与网页端共享四格式导入、去重和本机资料存储。",
      "无需模型生成规则目录，按需在线分析并保留可核对来源。",
      "本地结果与智能报告独立，支持后台任务和 Markdown / JSON 导出。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/cs-study-assistant",
    sourceLabel: "GitHub",
    sourceVisibility: "public",
    featured: true,
  },
  {
    slug: "air-ticket-system",
    stage: "university",
    title: "航空订票系统",
    kind: "课程设计 · Web 全栈项目",
    period: "2026",
    summary: "基于 Java 17、Spring Boot 3.2.5 与 Vue 3 的航班业务系统，覆盖查询、订票、模拟支付、改签和退票。",
    background: "课程设计的航班预订业务系统，以旅客查询航班、创建订单和办理订单变更为主线，并提供管理员维护功能。",
    features: ["注册登录并按出发地、目的地和日期查询航班；选择舱位并填写多名乘机人信息。", "创建订单并进行模拟支付，支持取消、改签和退票。", "管理员启停用户、维护或停飞航班、查询订单并查看统计。"],
    implementation: [
      { title: "后端架构", description: "使用 Java 17、Spring Boot 3.2.5、Spring Security、JWT、MyBatis-Plus、MySQL 8 和 Flyway。JWT 签名密钥通过环境变量提供，缺失或仍为占位值时拒绝启动。" },
      { title: "余票与超时订单", description: "通过条件更新扣减余票；按支付期限扫描超时待支付订单，自动取消并释放余票。" },
      { title: "容量与价格编辑保护", description: "修改容量或价格时锁定库存行，保留已占用座位，拒绝将总容量降到已占用数量以下。" },
      { title: "改签结算", description: "计算改签差价，并以模拟补差或退差处理订单变更。" },
    ],
    limitations: ["支付、补差和退差均为模拟流程，没有接入真实支付渠道。", "航班库存保护不代表订单全生命周期并发安全；改签规则和选座仍为课程演示范围。"],
    stack: ["Java 17", "Spring Boot 3.2.5", "Spring Security", "JWT", "MyBatis-Plus", "Vue 3", "Vite", "Pinia", "Element Plus", "MySQL 8", "Flyway"],
    highlights: [
      "通过条件更新扣减余票，定时扫描并释放超时待支付订单的库存。",
      "以库存行锁保护容量和价格编辑，保留已占用座位。",
      "支持改签差价计算、模拟补差与退差，以及管理员订单查询和统计。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/air-ticket-system",
    sourceLabel: "GitHub",
    sourceVisibility: "public",
    featured: true,
  },
  {
    slug: "emberfall-arena",
    stage: "university",
    title: "余烬试炼 · Emberfall Arena",
    kind: "个人项目 · 浏览器游戏",
    period: "2026",
    summary: "原生 JavaScript 与 Canvas 2D 打造的俯视角像素肉鸽竞技游戏，提供经典远程、近战刀战和首领竞伤。1 名玩家与 11 名本地 AI 在四种主题地图中收集资源、升级构筑，并通过生存或首领伤害争取胜利。",
    background: "在浏览器中运行的本地 AI 竞技游戏，Node.js 提供静态服务。新增首领竞伤与地图选择，并将模式、战斗数值和渲染职责拆分为独立模块。",
    features: ["主菜单选择经典远程、近战刀战或首领竞伤；远程自动索敌射击，近战用鼠标定向、左键点击挥刀或按住连斩。", "两种武器各有独立技能池，通过升级三选一构筑；近战主动技能包括突进斩、旋风斩、重斩、穿云刺和护体刀阵。", "首领竞伤由 6 名远程与 6 名近战角色挑战余烬巨像，按实际首领伤害排名；角色倒下后可复活并保留成长，首领被击败或十分钟时限结束后结算。", "可选失落庭院、灰烬荒漠、冰封遗迹、幽暗沼泽或随机地图；资源、障碍与陷阱随种子生成。", "生存玩法包含分阶段交战与风暴缩圈；支持小地图、失焦自动暂停和死亡观战，暂停、死亡或结算后可回主菜单切换玩法。"],
    implementation: [
      { title: "模式与技能配置", description: "通过模式注册表分别配置武器、技能池、战斗规则与 AI 行为；技能效果和数值集中维护，支持远程、近战及首领玩法。" },
      { title: "近战输入与命中", description: "分别记录点击和按住状态；刀技按前摇、有效和恢复阶段执行，以扇形范围、视线和单次动作命中记录处理伤害，移动沿用地图碰撞。" },
      { title: "本地 AI 与首领规则", description: "规则型 AI 根据资源、距离、视线和威胁选择移动与技能；首领模式累计实际扣除的首领生命值用于排名。" },
      { title: "战斗与视觉分离", description: "独立绘制刀光、突进残影、蓄力和首领攻击预警；近战视觉余效不参与伤害判定，也不延长动作锁。" },
      { title: "模拟与地图", description: "使用 60Hz 固定模拟步长、Canvas 2D 渲染和种子随机生成；步长配置不代表实际帧率保证。" },
    ],
    limitations: ["本地单人浏览器对局，由本地 AI 参与；不支持网络联机、账号、在线排行榜或持久化存档。首领挑战提供局内伤害排名。", "近战不含翻滚、格挡或弹反；源码未声明开源许可证，实际帧率与设备兼容性需实机验证。"],
    stack: ["JavaScript", "ES Modules", "Canvas 2D", "HTML/CSS", "Web Audio", "Node.js"],
    highlights: [
      "提供经典远程、近战刀战与首领竞伤三种玩法，首领挑战混合远近战角色并按实际伤害排名。",
      "四种主题地图与随机地图；双武器技能池通过升级三选一构筑。",
      "近战包含五种主动刀技，并将视觉余效与伤害判定分开。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/emberfall-arena",
    sourceLabel: "GitHub",
    sourceVisibility: "public",
  },
  {
    slug: "power-report-platform",
    stage: "university",
    title: "电力技术监督 AI 报告生成平台",
    kind: "软件项目综合实践 · 八人团队课程项目",
    period: "2026",
    summary: "参与技术监督辅助平台的报告生成模块，围绕报告创建、大纲编辑、SSE 正文生成、人工修改与多格式导出完成团队实现和测试。",
    background: "在上海电力大学《软件项目综合实践》课程中，我参与八人小组开发技术监督辅助平台的报告生成模块。项目面向迎峰度夏检查报告和煤库存审计报告，贯通模板与素材管理、大纲及正文生成、人工编辑和文件导出。",
    role: "我参与后端模板与专业素材管理、DOCX/Markdown/TXT 导出，也承担功能测试、问题记录和部分文档整理；重点关注文件校验、权限边界、编辑内容保存与异常处理。",
    features: ["管理报告模板和专业素材，并创建报告。", "编辑大纲，按 SSE 流式生成正文，再由用户检查和保存。", "将报告导出为 DOCX、Markdown 或 TXT。"],
    implementation: [
      { title: "前后端协作", description: "后端使用 FastAPI、SQLAlchemy 和 MySQL；前端使用 React 18 与 TypeScript。" },
      { title: "流式生成与编辑", description: "使用 SSE 将生成中的正文流式传到页面，用户可以检查、修改并保存内容。" },
      { title: "模板素材与多格式导出", description: "后端管理 DOCX 模板和专业素材，供报告创建时使用；报告可导出为 DOCX、Markdown 或 TXT。" },
    ],
    limitations: ["这是课程团队项目的一部分，我的工作范围限于报告生成模块相关功能。AI 生成内容需要人工核对；原始报告不公开。"],
    stack: ["FastAPI", "React 18", "TypeScript", "SQLAlchemy", "MySQL", "SSE", "python-docx", "pytest"],
    highlights: [
      "参与 DOCX 模板和专业素材的上传、管理与使用规则校验。",
      "参与报告大纲、流式正文、人工编辑保存到多格式导出的业务链路。",
      "围绕权限隔离、异常输入、素材选择、编辑保护和文件导出开展验证与问题记录。",
    ],
  },
];

const FEATURED_PROJECT_ORDER = [
  "campus-card-system",
  "air-ticket-system",
  "cs-study-assistant",
];

export const FEATURED_PROJECTS = FEATURED_PROJECT_ORDER
  .map(slug => PORTFOLIO_PROJECTS.find(project => project.slug === slug))
  .filter((project): project is PortfolioProject => project !== undefined);

export function getPortfolioProject(slug: string): PortfolioProject | undefined {
  return PORTFOLIO_PROJECTS.find(project => project.slug === slug);
}
