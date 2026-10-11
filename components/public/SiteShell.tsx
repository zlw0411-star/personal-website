import type { Profile } from "@/lib/content-types";
import { DEFAULT_PROFILE } from "@/lib/content-types";
import Footer from "./resume-template/Footer";
import Header from "./resume-template/Header";

export function SiteShell({ children, profile = DEFAULT_PROFILE, currentSection = "home" }: { children: React.ReactNode; profile?: Profile; currentSection?: "home" | "experience" | "life" }) {
  return <>
    <a className="rr-skip-link" href="#public-content">跳到正文</a>
    <Header profile={profile} currentSection={currentSection} />
    <main id="public-content" tabIndex={-1}>{children}</main>
    <Footer profile={profile} />
  </>;
}
