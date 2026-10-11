import { DEFAULT_PROFILE } from "@/lib/content-types";
import { getProfile } from "@/lib/server/content";
import { SiteShell } from "@/components/public/SiteShell";
import About from "@/components/public/resume-template/About";
import Hero from "@/components/public/resume-template/Hero";
import ResumeSection from "@/components/public/resume-template/ResumeSection";
import Section from "@/components/public/resume-template/Section";
import Reveal from "@/components/public/Reveal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = (await getProfile().catch(() => DEFAULT_PROFILE)) ?? DEFAULT_PROFILE;
  return <SiteShell profile={profile}><div className="rr-home">
    <Hero profile={profile} />
    <About profile={profile} />
    {profile.experience.trim() && <Section sectionId="resume" className="rr-resume">
      <Reveal className="rr-resume-reveal"><ResumeSection title="经历概览"><p className="rr-experience-overview">{profile.experience}</p></ResumeSection></Reveal>
    </Section>}
  </div></SiteShell>;
}
