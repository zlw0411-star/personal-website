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
          <p>精选 Java 全栈业务工程与智能硬件实践，呈现从业务流程到软硬件协作的项目经验。</p>
        </div>
        <Link className="portfolio-heading-link" href="/projects">查看全部项目 <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </Reveal>
      <div className="portfolio-featured-grid">
        {FEATURED_PROJECTS.map(project => <Reveal key={project.slug}><PortfolioProjectCard project={project} /></Reveal>)}
      </div>
    </section>

    <About profile={profile} />
  </div></SiteShell>;
}
