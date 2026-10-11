import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Category, Entry, Profile } from "@/lib/content-types";
import { CATEGORY_INFO, formatDate } from "@/lib/content-types";
import { SiteShell } from "./SiteShell";
import { EntryCard } from "./EntryCard";

export function CategoryPage({ category, entries, profile }: { category: Category; entries: Entry[]; profile: Profile }) {
  const isExperience = category === "learning";
  const info = CATEGORY_INFO[category];
  const description = isExperience ? "记录求学、实习、工作与项目实践中的每一段成长。" : info.description;

  return <SiteShell profile={profile}><div className={`wrap listing-page${isExperience ? " experience-page" : ""}`}>
    <Link className="back-link" href="/"><ArrowLeft size={15}/> 回到首页</Link>
    <header className={`listing-hero listing-${category}`}>
      {isExperience ? <span className="eyebrow">求学 · 实习 · 工作 · 项目</span> : <span className="eyebrow">A NOTEBOOK OF {category === "life" ? "LIFE" : "PROJECTS"}</span>}
      <h1>{info.label}{!isExperience && <span className="title-dot">.</span>}</h1>
      <p>{description}</p>
      <span className="listing-count">{String(entries.length).padStart(2, "0")} 篇记录</span>
    </header>
    {entries.length ? isExperience ? <div className="experience-list">{entries.map(entry => <Link className="experience-entry" href={`/entries/${encodeURIComponent(entry.id)}`} key={entry.id}>
      <span className="experience-entry-date">记录日期 · <time dateTime={entry.publishedAt ?? undefined}>{formatDate(entry.publishedAt)}</time></span>
      <h2>{entry.title}<ArrowUpRight size={17} aria-hidden="true" /></h2>
      {entry.summary && <p>{entry.summary}</p>}
    </Link>)}</div> : <div className="entry-grid listing-grid">{entries.map((entry, i) => <EntryCard key={entry.id} entry={entry} featured={i === 0}/>)}</div> : <div className={`empty-list${isExperience ? " experience-empty" : ""}`}>
      <span className="empty-line"/>
      {isExperience ? <><h2>目前还没有公开的经历记录。</h2><p>求学、实习、工作和项目的记录，将在整理后展示于此。</p></> : <><h2>目前还没有公开记录。</h2><p>新的记录会在这里慢慢呈现。</p></>}
    </div>}
  </div></SiteShell>;
}
