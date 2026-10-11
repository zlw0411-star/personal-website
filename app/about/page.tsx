import type { Metadata } from "next";
import { DEFAULT_PROFILE } from "@/lib/content-types";
import { getProfile } from "@/lib/server/content";
import { SiteShell } from "@/components/public/SiteShell";
import About from "@/components/public/resume-template/About";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "关于",
  description: "关于我、联系方式与正在持续学习的方向。",
};

export default async function AboutPage() {
  const profile = (await getProfile().catch(() => DEFAULT_PROFILE)) ?? DEFAULT_PROFILE;
  return <SiteShell profile={profile} currentSection="about">
    <div className="portfolio-page-wrap portfolio-about-page">
      <header className="portfolio-page-hero portfolio-about-hero">
        <p className="portfolio-kicker">ABOUT</p>
        <h1>关于我</h1>
        <p>这里保留更完整的个人介绍和联系方式；首页只放最重要的信息。</p>
      </header>
      <About profile={profile} />
    </div>
  </SiteShell>;
}
