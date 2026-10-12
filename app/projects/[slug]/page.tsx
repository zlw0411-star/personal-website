import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Code2 } from "lucide-react";
import { DEFAULT_PROFILE } from "@/lib/content-types";
import { getProfile } from "@/lib/server/content";
import { getPortfolioProject, PORTFOLIO_PROJECTS } from "@/lib/portfolio-data";
import { SiteShell } from "@/components/public/SiteShell";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return PORTFOLIO_PROJECTS.map(project => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getPortfolioProject(slug);
  return project ? { title: project.title, description: project.summary } : {};
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getPortfolioProject(slug);
  if (!project) notFound();
  const profile = (await getProfile().catch(() => DEFAULT_PROFILE)) ?? DEFAULT_PROFILE;

  return <SiteShell profile={profile} currentSection="projects">
    <article className="portfolio-detail-wrap">
      <Link className="portfolio-back-link" href="/projects"><ArrowLeft size={15} aria-hidden="true" /> 返回项目列表</Link>
      <header className="portfolio-detail-hero">
        <div className="portfolio-detail-meta"><span>{project.kind}</span><span>{project.period}</span></div>
        <h1>{project.title}</h1>
        <p className="portfolio-detail-summary">{project.summary}</p>
        <div className="portfolio-tags portfolio-detail-tags">{project.stack.map(item => <span key={item}>{item}</span>)}</div>
        {(project.sourceUrl || project.note) && <div className="portfolio-detail-actions">
          {project.sourceUrl && <a href={project.sourceUrl} target="_blank" rel="noopener noreferrer"><Code2 size={16} aria-hidden="true" /> 查看 {project.sourceLabel ?? "GitHub"} <ArrowUpRight size={15} aria-hidden="true" /></a>}
          {project.note && <span>{project.note}</span>}
        </div>}
      </header>

      {project.role && <section className="portfolio-detail-section">
        <p className="portfolio-kicker">MY ROLE</p>
        <h2>我负责的部分</h2>
        <p>{project.role}</p>
      </section>}

      <section className="portfolio-detail-section">
        <p className="portfolio-kicker">HIGHLIGHTS</p>
        <h2>项目亮点</h2>
        <ul className="portfolio-highlight-list">
          {project.highlights.map(item => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="portfolio-detail-section portfolio-detail-note">
        <p className="portfolio-kicker">ABOUT THIS PROJECT</p>
        <h2>项目说明</h2>
        <p>{project.background ?? "这是大学阶段的学习与实践记录。页面只描述目前有材料或代码可以支撑的内容；后续可以继续补充真实截图、课程背景、具体问题与解决过程。"}</p>
      </section>
    </article>
  </SiteShell>;
}
