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
        {(project.sourceVisibility === "public" && project.sourceUrl || project.sourceVisibility === "private" || project.note) && <div className="portfolio-detail-actions">
          {project.sourceVisibility === "public" && project.sourceUrl && <a href={project.sourceUrl} target="_blank" rel="noopener noreferrer"><Code2 size={16} aria-hidden="true" /> 查看 {project.sourceLabel ?? "GitHub"} <ArrowUpRight size={15} aria-hidden="true" /></a>}
          {project.sourceVisibility === "private" && <span>源码暂未公开</span>}
          {project.note && <span>{project.note}</span>}
        </div>}
      </header>

      {project.background && <section className="portfolio-detail-section">
        <p className="portfolio-kicker">BACKGROUND</p>
        <h2>项目背景</h2>
        <p>{project.background}</p>
      </section>}

      {project.features && project.features.length > 0 && <section className="portfolio-detail-section">
        <p className="portfolio-kicker">FEATURES</p>
        <h2>主要功能</h2>
        <ul className="portfolio-detail-list">
          {project.features.map(item => <li key={item}>{item}</li>)}
        </ul>
      </section>}

      {project.implementation && project.implementation.length > 0 && <section className="portfolio-detail-section">
        <p className="portfolio-kicker">IMPLEMENTATION</p>
        <h2>技术实现与设计</h2>
        <div className="portfolio-implementation-list">
          {project.implementation.map(item => <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>)}
        </div>
      </section>}

      {project.role && <section className="portfolio-detail-section">
        <p className="portfolio-kicker">MY CONTRIBUTION</p>
        <h2>我参与的部分</h2>
        <p>{project.role}</p>
      </section>}

      {project.limitations && project.limitations.length > 0 && <section className="portfolio-detail-section">
        <p className="portfolio-kicker">SCOPE</p>
        <h2>项目范围</h2>
        <ul className="portfolio-detail-list">
          {project.limitations.map(item => <li key={item}>{item}</li>)}
        </ul>
      </section>}

    </article>
  </SiteShell>;
}
