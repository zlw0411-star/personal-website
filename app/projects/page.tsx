import type { Metadata } from "next";
import { DEFAULT_PROFILE } from "@/lib/content-types";
import { getProfile } from "@/lib/server/content";
import { PORTFOLIO_PROJECTS, PORTFOLIO_STAGES } from "@/lib/portfolio-data";
import { SiteShell } from "@/components/public/SiteShell";
import { PortfolioProjectCard } from "@/components/public/PortfolioProjectCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "项目",
  description: "课程设计、个人项目与实践案例。",
};

export default async function ProjectsPage() {
  const profile = (await getProfile().catch(() => DEFAULT_PROFILE)) ?? DEFAULT_PROFILE;
  return <SiteShell profile={profile} currentSection="projects">
    <div className="portfolio-page-wrap">
      <header className="portfolio-page-hero">
        <p className="portfolio-kicker">PROJECTS</p>
        <h1>项目</h1>
        <p>这里既有可以查看源码的个人与课程项目，也有源码未保留但有完整过程记录的课程实践案例。</p>
      </header>
      {PORTFOLIO_STAGES.map(stage => {
        const projects = PORTFOLIO_PROJECTS.filter(project => project.stage === stage.id);
        if (projects.length === 0) return null;
        return <section className="portfolio-project-stage" id={stage.id} aria-labelledby={`${stage.id}-title`} key={stage.id}>
          <div className="portfolio-project-stage-heading">
            <h2 id={`${stage.id}-title`}>{stage.label}</h2>
            <span>{projects.length} 个项目</span>
          </div>
          <div className="portfolio-project-list">
            {projects.map(project => <PortfolioProjectCard key={project.slug} project={project} compact />)}
          </div>
        </section>;
      })}
    </div>
  </SiteShell>;
}
