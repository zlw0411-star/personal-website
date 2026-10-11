/**
 * Desktop navigation structure adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Sections/Header.tsx (DesktopNav)
 * Upstream: https://github.com/tbakerx/react-resume-template/tree/49ce16c0dd1b382edc1ec2cef6120345776d19b9/src/components/Sections
 * License: MIT; full text at vendor/react-resume-template/LICENSE
 */
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import type { Profile } from "@/lib/content-types";

const navigation = [
  { label: "首页", href: "/" },
  { label: "经历", href: "/experience" },
  { label: "生活", href: "/life" },
];

export default function Header({ profile, currentSection }: { profile: Profile; currentSection: "home" | "experience" | "life" }) {
  return <header className="rr-header">
    <div className="rr-header-inner">
      <Link className="rr-brand" href="/" aria-label={`${profile.siteName}，首页`}>
        <span className="rr-brand-mark" aria-hidden="true">{profile.nickname.slice(0, 1) || "我"}</span>
        <span className="rr-brand-name">{profile.siteName}</span>
      </Link>
      <nav aria-label="主导航" className="rr-main-nav">
        {navigation.map(item => {
          const section = item.href === "/" ? "home" : item.href === "/life" ? "life" : "experience";
          const active = section === currentSection;
          return <Link className="rr-nav-link" href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
            {item.label}{item.href === "/life" && <LockKeyhole className="rr-nav-lock" size={13} aria-hidden="true" />}
          </Link>;
        })}
      </nav>
    </div>
  </header>;
}
