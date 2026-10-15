import { SiteLink } from "@/components/public/SiteLink";
import { ArrowLeft } from "lucide-react";
import type { Category, Entry, Profile } from "@/lib/content-types";
import { CATEGORY_INFO } from "@/lib/content-types";
import { SiteShell } from "./SiteShell";
import { EntryCard } from "./EntryCard";
import Section from "./resume-template/Section";
import ResumeSection from "./resume-template/ResumeSection";
import TimelineItem from "./resume-template/TimelineItem";
import Reveal from "./Reveal";

export function CategoryPage({ category, entries, profile }: { category: Exclude<Category, "life">; entries: Entry[]; profile: Profile }) {
  const isExperience = category === "learning";
  const info = CATEGORY_INFO[category];
  const description = isExperience ? "记录求学、实习、工作与项目实践中的每一段成长。" : info.description;

  return <SiteShell profile={profile} currentSection="experience"><div className={`wrap listing-page${isExperience ? " experience-page rr-experience-page" : ""}`}>
    <SiteLink className="back-link" href="/"><ArrowLeft size={15}/> 回到首页</SiteLink>
    <header className={`listing-hero listing-${category}${isExperience ? " rr-experience-header" : ""}`}>
      {isExperience ? <span className="eyebrow">求学 · 实习 · 工作 · 项目</span> : <span className="eyebrow">A NOTEBOOK OF PROJECTS</span>}
      <h1>{info.label}{!isExperience && <span className="title-dot">.</span>}</h1>
      <p>{description}</p>
      <span className={`listing-count${isExperience ? " rr-record-count" : ""}`}>{String(entries.length).padStart(2, "0")} 篇记录</span>
    </header>
    {isExperience ? <Section sectionId="experience-records" className="rr-resume">
      <ResumeSection title="经历记录">
        {entries.length ? <Reveal className="rr-experience-list">{entries.map(entry => <TimelineItem entry={entry} key={entry.id} />)}</Reveal> : <div className="empty-list experience-empty">
          <span className="empty-line"/>
          <h3>目前还没有公开的经历记录。</h3>
          <p>求学、实习、工作和项目的记录，将在整理后展示于此。</p>
        </div>}
      </ResumeSection>
    </Section> : entries.length ? <div className="entry-grid listing-grid">{entries.map((entry, i) => <EntryCard key={entry.id} entry={entry} featured={i === 0}/>)}</div> : <div className="empty-list">
      <span className="empty-line"/>
      <h2>目前还没有公开记录。</h2>
      <p>新的记录会在这里慢慢呈现。</p>
    </div>}
  </div></SiteShell>;
}
