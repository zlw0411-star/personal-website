/**
 * Footer layout adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Sections/Footer.tsx
 * Upstream: https://github.com/tbakerx/react-resume-template/tree/49ce16c0dd1b382edc1ec2cef6120345776d19b9/src/components/Sections
 * License: MIT; full text at vendor/react-resume-template/LICENSE
 */
import { SiteLink } from "@/components/public/SiteLink";
import type { Profile } from "@/lib/content-types";

export default function Footer({ profile }: { profile: Profile }) {
  return <footer className="rr-footer">
    <div className="rr-footer-content">
      <div>
        <p className="rr-footer-copyright">© {new Date().getFullYear()} {profile.nickname}</p>
        <p className="portfolio-footer-note">记录项目、经历与持续成长。</p>
      </div>
      <div className="rr-footer-links">
        <SiteLink className="rr-footer-admin" href="/admin">管理内容</SiteLink>
        <a className="rr-footer-source" href="https://github.com/tbakerx/react-resume-template" target="_blank" rel="noopener noreferrer">模板来源</a>
      </div>
    </div>
  </footer>;
}
