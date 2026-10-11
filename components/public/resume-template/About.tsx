/**
 * Adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Sections/About.tsx
 * Upstream: 49ce16c0dd1b382edc1ec2cef6120345776d19b9
 * Full license: vendor/react-resume-template/LICENSE
 */
import { DEFAULT_PROFILE, profileContacts, type Profile } from "@/lib/content-types";
import Section from "./Section";
import { ProfileContacts } from "./Contacts";
import Reveal from "../Reveal";

export default function About({ profile }: { profile: Profile }) {
  const aboutParagraphs = profile.about.trim() === DEFAULT_PROFILE.about.trim()
    ? []
    : profile.about.split(/\n+/).map(value => value.trim()).filter(Boolean);
  const hasContacts = profileContacts(profile).length > 0;
  if (aboutParagraphs.length === 0 && !hasContacts) return null;
  const hasAbout = aboutParagraphs.length > 0;
  const gridClassName = hasAbout && hasContacts ? "rr-about-grid" : "rr-about-grid rr-about-grid-single";

  const sectionLabel = hasAbout ? "rr-about-title" : "rr-contacts-title";
  return <Section className="rr-about" sectionId="about" labelledBy={sectionLabel}>
    <Reveal className={gridClassName}>
      {hasAbout && <section className="rr-about-copy">
        <p className="rr-section-kicker">ABOUT</p>
        <h2 id="rr-about-title">个人介绍</h2>
        <div className="rr-about-copy-text">
          {aboutParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </section>}
      {hasContacts && <div className={hasAbout ? "rr-about-contact" : "rr-about-contact rr-about-contact-single"}>
        <p className="rr-section-kicker">CONTACT</p>
        <ProfileContacts profile={profile} headingLevel={aboutParagraphs.length > 0 ? 3 : 2} />
      </div>}
    </Reveal>
  </Section>;
}
