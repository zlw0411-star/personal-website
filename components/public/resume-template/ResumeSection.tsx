import type { ReactNode } from "react";

/**
 * Adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Sections/Resume/ResumeSection.tsx
 * Upstream: 49ce16c0dd1b382edc1ec2cef6120345776d19b9
 * Full license: vendor/react-resume-template/LICENSE
 */
export default function ResumeSection({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rr-resume-section">
    <div className="rr-resume-title">
      <div className="relative h-max">
        <h2 className="text-xl font-bold uppercase">{title}</h2>
        <span aria-hidden="true" className="rr-section-accent absolute inset-x-0 -bottom-1 border-b-2" />
      </div>
    </div>
    <div className="rr-resume-content">{children}</div>
  </div>;
}
