/**
 * Adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Layout/Section.tsx
 * Upstream: 49ce16c0dd1b382edc1ec2cef6120345776d19b9
 * Full license: vendor/react-resume-template/LICENSE
 */
export default function Section({
  children,
  sectionId,
  noPadding = false,
  className = "",
  labelledBy,
}: {
  children: React.ReactNode;
  sectionId: string;
  noPadding?: boolean;
  className?: string;
  labelledBy?: string;
}) {
  const sectionClassName = [className, !noPadding && "px-4 py-16 md:py-24 lg:px-8"].filter(Boolean).join(" ");
  return <section className={sectionClassName} id={sectionId} aria-labelledby={labelledBy}>
    <div className={!noPadding ? "mx-auto max-w-screen-lg" : undefined}>{children}</div>
  </section>;
}
