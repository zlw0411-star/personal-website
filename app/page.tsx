import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DEFAULT_PROFILE } from "@/lib/content-types";
import { getProfile } from "@/lib/server/content";
import { FEATURED_PROJECTS } from "@/lib/portfolio-data";
import { SiteShell } from "@/components/public/SiteShell";
import About from "@/components/public/resume-template/About";
import Hero from "@/components/public/resume-template/Hero";
import Reveal from "@/components/public/Reveal";
import { PortfolioProjectCard } from "@/components/public/PortfolioProjectCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = (await getProfile().catch(() => DEFAULT_PROFILE)) ?? DEFAULT_PROFILE;
  return <SiteShell profile={profile}><div className="portfolio-home">
    <Hero profile={profile} />

    <section className="portfolio-section" aria-labelledby="featured-projects-title">
      <Reveal className="portfolio-section-heading">
        <div>
          <p className="portfolio-kicker">SELECTED WORK</p>
          <h2 id="featured-projects-title">精选项目</h2>
          <p>挑选少量最能代表不同能力方向的项目：真实硬件实践、完整 Web 工程和个人创意应用。</p>
        </div>
        <Link className="portfolio-heading-link" href="/projects">查看全部项目 <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </Reveal>
      <div className="portfolio-featured-grid">
        {FEATURED_PROJECTS.map(project => <Reveal key={project.slug}><PortfolioProjectCard project={project} /></Reveal>)}
      </div>
    </section>

    <section className="portfolio-section portfolio-experience-preview" aria-labelledby="experience-preview-title">
      <Reveal>
        <p className="portfolio-kicker">EXPERIENCE</p>
        <h2 id="experience-preview-title">从大学开始，记录每一段经历。</h2>
        <p>目前以大学阶段的学习、课程设计和个人项目为主。以后有实习和工作经历时，再按阶段继续补充。</p>
        <Link className="portfolio-text-link" href="/experience">查看大学阶段经历 <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </Reveal>
    </section>

    <About profile={profile} />
  </div></SiteShell>;
}
