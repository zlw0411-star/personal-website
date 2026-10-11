export type PortfolioProject = {
  slug: string;
  title: string;
  kind: string;
  period: string;
  summary: string;
  role?: string;
  stack: string[];
  highlights: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  featured?: boolean;
  note?: string;
};

export const PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    slug: "atlas-power-robot-arm",
    title: "基于 Atlas 200DK 的智能机械臂电力运维",
    kind: "电力智能系统综合实践 · 团队课程项目",
    period: "2026",
    summary: "围绕电力智能运维演示场景，构建从视觉识别、坐标映射到机械臂抓取的闭环，并扩展语音控制能力。",
    role: "主要负责视觉感知与 AI 识别模块：相机标定、ROI 与透视变换、YOLOv5/.om 推理、像素坐标到世界坐标映射，以及语音指令接入。",
    stack: ["Atlas 200I DK A2", "YOLOv5", "OpenCV", "ROS2", "MiMo"],
    highlights: [
      "经过重新标定与 offset 补偿，抓取坐标误差由约 3–5 cm 降至 1–2 cm。",
      "通过数据增强、阈值调整与 NMS 后处理，检测准确率提升至 90% 以上。",
      "实现抓取、连续抓取、停止和回位等语音命令到机械臂控制接口的映射。",
    ],
    featured: true,
    note: "课程团队项目 · 源码未保留",
  },
  {
    slug: "campus-card-system",
    title: "青禾校园卡管理系统",
    kind: "课程设计 · Web 全栈项目",
    period: "2026",
    summary: "面向校园卡充值、消费、流水与后台管理的完整业务系统，重点处理金额精度、并发一致性和重复请求。",
    stack: ["Spring Boot", "Vue 3", "TypeScript", "MySQL", "Playwright"],
    highlights: [
      "金额统一使用 BigDecimal 处理，避免浮点误差。",
      "充值与消费流程加入事务锁和幂等控制，降低重复提交与并发问题。",
      "包含后端测试、前端测试、Playwright E2E 与 GitHub Actions CI。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/campus-card-system",
    sourceLabel: "GitHub",
    featured: true,
  },
  {
    slug: "desktop-pet",
    title: "Desktop Pet",
    kind: "个人项目 · 桌面应用",
    period: "2026",
    summary: "使用 PySide6 制作 Windows 桌面宠物，支持拖拽、投掷、动画、自定义素材、聊天和可选 AI 对话。",
    stack: ["Python", "PySide6", "AI API", "GIF", "pytest"],
    highlights: [
      "支持拖拽、投掷、抚摸与多种 GIF / 图片素材。",
      "提供本地命令和可选 AI 对话能力，并通过环境变量配置模型密钥。",
      "加入缓存、FPS 控制、单元测试和性能基准。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/desktop-pet",
    sourceLabel: "GitHub",
    featured: true,
  },
  {
    slug: "java-ee-ordering",
    title: "Java EE 餐饮点餐系统",
    kind: "课程设计 · 微服务实践",
    period: "2026",
    summary: "包含顾客、服务员和管理员角色的餐饮点餐系统，拆分用户与订单服务，并覆盖结账、会员折扣和营收统计等流程。",
    stack: ["Spring Boot", "Nacos", "OpenFeign", "JPA", "Vue 3", "MySQL"],
    highlights: [
      "拆分 user-service 与 order-service，并使用 Nacos 和 OpenFeign 完成服务治理与调用。",
      "覆盖点餐、订单状态、结账、会员折扣与统计等完整业务流程。",
      "数据库设计包含存储过程、触发器和行锁等实践。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/java-ee",
    sourceLabel: "GitHub",
  },
  {
    slug: "cs-study-assistant",
    title: "408 学习助手",
    kind: "个人学习工具",
    period: "2026",
    summary: "为计算机考研 408 学习整理真题、错题与知识点掌握情况，支持 PDF 导入、本地检索和学习记录。",
    stack: ["Python", "Streamlit", "SQLite", "pypdf", "BM25", "jieba"],
    highlights: [
      "支持文本型 PDF 导入、题目分类和错题记录。",
      "使用 BM25 与中文分词完成本地检索，不依赖云端数据库。",
      "个人题库和数据库不提交到仓库，代码与学习数据分离。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/cs-study-assistant",
    sourceLabel: "GitHub",
  },
  {
    slug: "air-ticket-system",
    title: "航空订票系统",
    kind: "课程设计 · 后端业务实践",
    period: "2026",
    summary: "覆盖航班查询、订票、模拟支付、退款与改签的前后端系统，并重点处理座位占用与超时释放。",
    stack: ["Java 17", "Spring Boot", "Spring Security", "JWT", "MyBatis-Plus", "Vue 3"],
    highlights: [
      "订票时锁定座位，并在超时后自动释放。",
      "使用条件更新减少超卖风险。",
      "覆盖退款、改签和管理员维护等业务流程。",
    ],
    sourceUrl: "https://github.com/zlw0411-star/air-ticket-system",
    sourceLabel: "GitHub",
  },
  {
    slug: "power-report-platform",
    title: "电力技术监督 AI 报告生成平台",
    kind: "软件项目综合实践 · 团队课程项目",
    period: "2026",
    summary: "面向电力行业技术监督场景，覆盖报告创建、模板驱动大纲、正文流式生成、人工编辑、素材管理与多格式导出。",
    stack: ["FastAPI", "React", "Vite", "JWT", "SSE", "LLM", "DOCX"],
    highlights: [
      "报告流程覆盖基础信息、大纲、正文、预览与导出。",
      "支持 DOCX、Markdown、TXT 多格式导出，并保留人工编辑后的内容。",
      "团队项目材料中包含权限控制、文件校验、状态管理与异常测试。",
    ],
    note: "课程团队项目 · 源码未保留；个人职责文案后续可按最终分工材料继续完善",
  },
];

export const FEATURED_PROJECTS = PORTFOLIO_PROJECTS.filter(project => project.featured);

export function getPortfolioProject(slug: string): PortfolioProject | undefined {
  return PORTFOLIO_PROJECTS.find(project => project.slug === slug);
}
