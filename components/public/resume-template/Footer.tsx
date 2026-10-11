/**
 * Footer layout adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Sections/Footer.tsx
 * Upstream: https://github.com/tbakerx/react-resume-template/tree/49ce16c0dd1b382edc1ec2cef6120345776d19b9/src/components/Sections
 * License: MIT; full text at vendor/react-resume-template/LICENSE
 */
import Link from "next/link";
import type { Profile } from "@/lib/content-types";

export default function Footer({ profile }: { profile: Profile }) {
  return <footer className="rr-footer">
    <div className="rr-footer-content">
      <p className="rr-footer-copyright">© {new Date().getFullYear()} {profile.nickname}</p>
      <div className="rr-footer-links">
        <Link className="rr-footer-admin" href="/admin">管理内容</Link>
        <a className="rr-footer-source" href="https://github.com/tbakerx/react-resume-template" target="_blank" rel="noopener noreferrer">基于 React Resume Template 二创</a>
      </div>
    </div>
  </footer>;
}
