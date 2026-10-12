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
    featured: true,
    note: "课程团队项目 · 源码未保留",
  },
  {
    slug: "campus-card-system",
    stage: "university",
    title: "青禾校园卡管理系统",
    kind: "课程设计 · Web 全栈项目",
    period: "2026",
    summary: "基于 Vue 3、TypeScript、Spring Boot 4 与 MySQL 的校园卡 Web 系统，覆盖学生账户与交易、模拟充值消费及管理员账户管理。",
    background: "项目围绕校园卡日常使用场景，串联余额查询、模拟充值与消费、交易记录查询和导出，以及管理员账户维护。",
    features: ["查询账户余额与交易记录。", "进行模拟充值、消费，并导出交易记录。", "管理员维护账户信息。"],
    implementation: [
      { title: "金额与并发一致性", description: "金额使用 BigDecimal；充值和消费通过事务、锁和唯一操作号约束重复请求及并发更新。" },
      { title: "异常恢复", description: "请求结果不确定时，客户端先按操作号查询结果；重试沿用相同操作号，刷新页面后可恢复操作状态。" },
      { title: "会话与验证", description: "使用同源 HttpOnly Session 和 CSRF 防护，提供手机端布局、接口测试及隔离 MySQL 的 CI 工作流。" },
    ],
    limitations: ["充值和消费是系统内模拟操作，不涉及真实资金或校园卡服务。"],
    stack: ["Vue 3", "TypeScript", "Pinia", "Spring Boot 4", "MySQL 8", "Playwright"],
    highlights: [
      "使用 BigDecimal 处理金额，并通过事务锁与唯一操作号约束充值、消费的一致性。",
      "异常请求先查询操作结果，再用同一操作号重试；页面刷新后可恢复操作状态。",
      "采用同源 HttpOnly Session 与 CSRF 防护，并适配手机端使用。",
      "加入接口测试和隔离 MySQL 的 GitHub Actions 工作流。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/campus-card-system",
    sourceLabel: "GitHub",
    sourceVisibility: "private",
    featured: true,
  },
  {
    slug: "desktop-pet",
    stage: "university",
    title: "Desktop Pet",
    kind: "个人项目 · 桌面应用",
    period: "2026",
    summary: "使用 PySide6 制作 Windows 桌面宠物，支持拖拽、投掷、动画、自定义素材、聊天和可选 AI 对话。",
    background: "个人桌面应用项目，目标是在 Windows 桌面提供可交互的宠物窗口，并支持用户配置外观素材和对话能力。",
    features: ["拖拽、投掷和抚摸等桌面交互。", "使用 GIF 或图片素材呈现动画。", "支持本地命令与可选 AI 对话。"],
    implementation: [
      { title: "桌面交互", description: "使用 PySide6 实现拖拽、投掷、坐在窗口上等交互，并支持多种内置形象和自定义图片/GIF。" },
      { title: "动画与资源占用", description: "可设置 10–60 FPS；待机、睡眠会降低帧率，隐藏窗口时暂停动画与 GIF。图片缩放和描边结果会缓存。" },
      { title: "本地与 AI 聊天", description: "双击打开聊天；内置本地指令。AI 对话需用户自行配置服务，密钥从环境变量读取。" },
      { title: "可选抠图", description: "可选安装 rembg 与模型，在后台处理静态图片；GIF 保留动画并跳过静态抠图。" },
    ],
    limitations: ["AI 对话需要用户自行配置模型服务及密钥；默认使用本地交互能力。"],
    stack: ["Python", "PySide6", "GIF", "unittest"],
    highlights: [
      "支持拖拽、投掷、抚摸与多种 GIF / 图片素材。",
      "提供本地命令和可选 AI 对话能力，并通过环境变量配置模型密钥。",
      "加入缓存、FPS 控制、单元测试和性能基准。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/desktop-pet",
    sourceLabel: "GitHub",
    sourceVisibility: "private",
    featured: false,
  },
  {
    slug: "java-ee-ordering",
    stage: "university",
    title: "Java EE 餐饮点餐系统",
    kind: "课程设计 · 微服务实践",
    period: "2026",
    summary: "包含顾客、服务员和管理员角色的餐饮点餐系统，拆分用户与订单服务，并覆盖结账、会员折扣和营收统计等流程。",
    background: "课程设计项目，以餐饮门店点餐与结账为业务场景，按用户和订单领域拆分后端服务。",
    features: ["顾客可自助点餐并查看本人订单，服务员可选桌代点、加菜和结账。", "管理员维护菜品、餐桌、用户和会员等级，并查看营收报表。", "订单提交、结账及取消会带动餐桌占用状态变化。"],
    implementation: [
      { title: "服务发现与会员折扣", description: "user-service 与 order-service 分开部署；订单服务通过 Nacos 发现用户服务，再用 OpenFeign 查询顾客会员折扣，会员等级数据由用户服务管理。" },
      { title: "订单与餐桌并发", description: "数据库行锁保证同一餐桌同时只有一个有效订单；同桌重复下单会合并到现有订单。结账或取消后释放餐桌。" },
      { title: "数据库业务对象", description: "MySQL 使用 JPA 持久化，并通过视图、营收存储过程和订单状态触发器支持明细查询、报表及餐桌占用/释放。" },
    ],
    limitations: ["这是课程实践项目，不代表已接入真实门店或生产运营。"],
    stack: ["Spring Boot 3.2.5", "Spring Cloud Alibaba", "Nacos", "OpenFeign", "JPA", "Vue 3", "Element Plus", "MySQL 8"],
    highlights: [
      "拆分 user-service 与 order-service，并使用 Nacos 和 OpenFeign 完成服务治理与调用。",
      "覆盖点餐、订单状态、结账、会员折扣与统计等完整业务流程。",
      "数据库设计包含存储过程、触发器和行锁等实践。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/java-ee",
    sourceLabel: "GitHub",
    sourceVisibility: "private",
  },
  {
    slug: "cs-study-assistant",
    stage: "university",
    title: "408 真题学习台",
    kind: "个人学习工具",
    period: "2026",
    summary: "一款本地 408 真题学习工具，围绕题目原文定位、错因复盘、考点自评和异年迁移组织练习。",
    background: "面向完成一轮基础复习后使用历年真题查漏补缺的学习场景，记录保存在本机。",
    features: ["导入可提取文字的 PDF，查看题目原文和对应页码。", "按科目、年份、考点及练习状态筛选，并辅助建议科目和考点分类。", "记录错因与复习状态，自评题目理解情况，并通过异年同考点题练习迁移。"],
    implementation: [
      { title: "原文导入与定位", description: "使用 pypdf 导入有可提取文字的 PDF，保存题目文本与原卷页码，练习时可回看原页。" },
      { title: "分类建议", description: "依据题号规则建议科目、依据关键词建议考点；建议可由使用者修正，不自动判断分类是否正确。" },
      { title: "本机记录", description: "题目和个人练习记录使用 SQLite 保存在本机；默认不连接模型，也不生成答案或自动判卷。" },
    ],
    limitations: ["克隆仓库后题库为空，需自行导入有权使用的材料；全扫描 PDF 不能导入并自动拆题。分类由规则辅助，练习效果由使用者自评。"],
    stack: ["Python", "Streamlit", "SQLite", "pypdf"],
    highlights: [
      "支持可提取文字的 PDF 导入、原文页码定位及本机 SQLite 学习记录。",
      "围绕错因复盘、考点辅助分类和异年同考点练习组织学习流程。",
      "不自动判卷、生成答案或推断掌握程度。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/cs-study-assistant",
    sourceLabel: "GitHub",
    sourceVisibility: "private",
  },
  {
    slug: "air-ticket-system",
    stage: "university",
    title: "航空订票系统",
    kind: "课程设计 · Web 全栈项目",
    period: "2026",
    summary: "基于 Java 17、Spring Boot 3.2.5 与 Vue 3 的航班业务系统，覆盖查询、订票、模拟支付、改签和退票。",
    background: "课程设计的航班预订业务系统，以旅客查询航班、创建订单和办理订单变更为主线，并提供管理员维护功能。",
    features: ["注册登录并按出发地、目的地和日期查询航班；选择舱位并填写乘机人信息。", "创建订单并进行模拟支付，支持改签和退票。", "管理员维护用户、航班和订单并查看统计。"],
    implementation: [
      { title: "后端架构", description: "使用 Java 17、Spring Boot 3.2.5、Spring Security、JWT、MyBatis-Plus、MySQL 8 和 Flyway。" },
      { title: "余票与超时订单", description: "通过条件更新扣减余票；待支付订单 15 分钟后自动取消并释放余票。" },
      { title: "改签结算", description: "计算改签差价，并以模拟补差或退差处理订单变更。" },
    ],
    limitations: ["支付、补差和退差均为模拟流程，没有接入真实支付渠道。"],
    stack: ["Java 17", "Spring Boot 3.2.5", "Spring Security", "JWT", "MyBatis-Plus", "Vue 3", "Vite", "Pinia", "Element Plus", "MySQL 8", "Flyway"],
    highlights: [
      "通过条件更新控制余票扣减，待支付订单 15 分钟后自动取消并释放余票。",
      "支持改签差价计算与模拟补差、退差，贯通订票后的主要订单变更流程。",
      "管理员可维护用户、航班和订单，并查看销售统计。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/air-ticket-system",
    sourceLabel: "GitHub",
    sourceVisibility: "private",
    featured: true,
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
  "atlas-power-robot-arm",
];

export const FEATURED_PROJECTS = FEATURED_PROJECT_ORDER
  .map(slug => PORTFOLIO_PROJECTS.find(project => project.slug === slug))
  .filter((project): project is PortfolioProject => project !== undefined);

export function getPortfolioProject(slug: string): PortfolioProject | undefined {
  return PORTFOLIO_PROJECTS.find(project => project.slug === slug);
}
