/**
 * Desktop navigation structure adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Sections/Header.tsx (DesktopNav)
 * Upstream: https://github.com/tbakerx/react-resume-template/tree/49ce16c0dd1b382edc1ec2cef6120345776d19b9/src/components/Sections
 * License: MIT; full text at vendor/react-resume-template/LICENSE
 */
import { SiteLink } from "@/components/public/SiteLink";
import type { Profile } from "@/lib/content-types";

const navigation = [
  { label: "首页", href: "/", section: "home" as const },
  { label: "项目", href: "/projects", section: "projects" as const },
  { label: "关于", href: "/about", section: "about" as const },
];

export default function Header({ profile, currentSection }: { profile: Profile; currentSection: "home" | "projects" | "experience" | "about" }) {
  return <header className="rr-header">
    <div className="rr-header-inner">
      <SiteLink className="rr-brand" href="/" aria-label={`${profile.siteName}，首页`}>
        <span className="rr-brand-mark" aria-hidden="true">{profile.nickname.slice(0, 1) || "我"}</span>
        <span className="rr-brand-name">{profile.siteName}</span>
      </SiteLink>
      <nav aria-label="主导航" className="rr-main-nav">
        {navigation.map(item => {
          const active = item.section === currentSection;
          return <SiteLink className="rr-nav-link" href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
            {item.label}
          </SiteLink>;
        })}
      </nav>
    </div>
  </header>;
}
