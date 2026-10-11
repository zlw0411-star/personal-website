import Link from "next/link";
import { ArrowUpRight, Github } from "lucide-react";
import type { PortfolioProject } from "@/lib/portfolio-data";

export function PortfolioProjectCard({ project, compact = false }: { project: PortfolioProject; compact?: boolean }) {
  return <article className={`portfolio-card${compact ? " portfolio-card-compact" : ""}`}>
    <div className="portfolio-card-topline">
      <span>{project.kind}</span>
      <span>{project.period}</span>
    </div>
    <div className="portfolio-card-body">
      <h3>{project.title}</h3>
      <p>{project.summary}</p>
      <div className="portfolio-tags" aria-label="技术栈">
        {project.stack.map(item => <span key={item}>{item}</span>)}
      </div>
    </div>
    <div className="portfolio-card-actions">
      <Link href={`/projects/${project.slug}`}>查看项目案例 <ArrowUpRight size={15} aria-hidden="true" /></Link>
      {project.sourceUrl && <a href={project.sourceUrl} target="_blank" rel="noopener noreferrer"><Github size={15} aria-hidden="true" />{project.sourceLabel ?? "GitHub"}</a>}
    </div>
  </article>;
}
