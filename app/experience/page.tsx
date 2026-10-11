import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DEFAULT_PROFILE } from "@/lib/content-types";
import { getProfile, listPublicEntries } from "@/lib/server/content";
import { SiteShell } from "@/components/public/SiteShell";
import TimelineItem from "@/components/public/resume-template/TimelineItem";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "经历",
  description: "按大学、实习与工作阶段记录学习、项目和成长经历。",
};

export default async function ExperiencePage() {
  const [profile, entries] = await Promise.all([
    getProfile().catch(() => DEFAULT_PROFILE),
    listPublicEntries("learning").catch(() => []),
  ]);

  return <SiteShell profile={profile ?? DEFAULT_PROFILE} currentSection="experience">
    <div className="portfolio-page-wrap experience-stage-page">
      <header className="portfolio-page-hero">
        <p className="portfolio-kicker">EXPERIENCE</p>
        <h1>经历</h1>
        <p>不把所有事情挤成一条履历，而是按人生阶段记录当时学了什么、做了什么，以及留下了哪些项目。</p>
      </header>

      <section className="experience-stage" aria-labelledby="university-stage-title">
        <div className="experience-stage-index">01</div>
        <div className="experience-stage-main">
          <div className="experience-stage-heading">
            <div>
              <p className="portfolio-kicker">UNIVERSITY</p>
              <h2 id="university-stage-title">大学期间</h2>
            </div>
            <span>当前阶段</span>
          </div>
          <p className="experience-stage-intro">以计算机课程学习、课程设计、个人项目和实践记录为主。后续有实习和工作经历时，会继续按阶段扩展，而不是提前放空栏目。</p>
          <Link className="portfolio-text-link" href="/projects">查看这一阶段的项目 <ArrowUpRight size={16} aria-hidden="true" /></Link>

          <div className="experience-stage-records">
            <div className="experience-stage-records-head">
              <h3>阶段记录</h3>
              <span>{entries.length} 条</span>
            </div>
            {entries.length ? <div className="rr-experience-list">{entries.map(entry => <TimelineItem entry={entry} key={entry.id} />)}</div> : <div className="experience-stage-empty">目前还没有公开的阶段记录，项目内容可先从项目页查看。</div>}
          </div>
        </div>
      </section>

      <section className="experience-future-note" aria-label="未来经历阶段说明">
        <p className="portfolio-kicker">NEXT</p>
        <h2>实习与工作经历以后再补。</h2>
        <p>等真正发生后，再新增对应阶段和详情页，保持网站内容真实、清楚，也方便长期维护。</p>
      </section>
    </div>
  </SiteShell>;
}
