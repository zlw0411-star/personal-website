import { ArrowUpRight, AtSign, Phone } from "lucide-react";
import { DEFAULT_PROFILE, profileContacts, type Contact } from "@/lib/content-types";
import { getProfile } from "@/lib/server/content";
import { SiteShell } from "@/components/public/SiteShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = (await getProfile().catch(() => DEFAULT_PROFILE)) ?? DEFAULT_PROFILE;
  const isPlaceholderAbout = profile.about.trim() === DEFAULT_PROFILE.about.trim();
  const isPlaceholderBio = profile.bio.trim() === DEFAULT_PROFILE.bio.trim();
  const aboutParagraphs = isPlaceholderAbout ? [] : profile.about.split(/\n+/).map(value => value.trim()).filter(Boolean);
  const contacts = profileContacts(profile).filter(contact => contact.value.trim());

  function renderContact(contact: Contact, index: number) {
    const label = contact.label.trim() || contact.value.trim();
    const value = contact.value.trim();
    const labeledValue = label !== value ? `${label}：${value}` : value;
    if (!value) return null;
    if (contact.kind === "email" && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
      return <a key={`${contact.kind}-${value}-${index}`} href={`mailto:${encodeURIComponent(value).replace("%40", "@")}`}><AtSign size={16} /><span className="home-contact-value">{labeledValue}</span><ArrowUpRight size={14} /></a>;
    }
    if (contact.kind === "phone" && /^\+?[\d\s().-]+$/.test(value) && (value.match(/\d/g)?.length ?? 0) > 0) {
      const dial = value.replace(/[^\d+]/g, "");
      return <a key={`${contact.kind}-${value}-${index}`} href={`tel:${dial}`}><Phone size={16} /><span className="home-contact-value">{labeledValue}</span><ArrowUpRight size={14} /></a>;
    }
    if (contact.kind === "link") {
      let safeUrl: string | null = null;
      try {
        const parsed = new URL(value);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") safeUrl = parsed.href;
      } catch { /* Show malformed legacy values as plain text. */ }
      if (safeUrl) return <a key={`${contact.kind}-${value}-${index}`} href={safeUrl} target="_blank" rel="noopener noreferrer"><span className="home-contact-value">{label}</span><ArrowUpRight size={14} /></a>;
    }
    return <span className="home-contact-text" style={{ overflowWrap: "anywhere" }} key={`${contact.kind}-${value}-${index}`}>{labeledValue}</span>;
  }

  return <SiteShell profile={profile}><div className="home-page wrap">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-profile-copy">
        <h1 id="home-title">你好，我是<br /><span>{profile.nickname}。</span></h1>
        {!isPlaceholderBio && profile.bio.trim() && <p className="home-bio">{profile.bio}</p>}
        {aboutParagraphs.length > 0 && <div className="home-about">{aboutParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
      </div>
      <div className="home-profile-media"><img src={profile.avatarId ? `/api/media/${encodeURIComponent(profile.avatarId)}` : "/avatar-placeholder.svg"} alt={`${profile.nickname}的头像`} /></div>
    </section>
    {profile.experience.trim() && <section className="home-experience" aria-label="经历概览"><h2>经历概览</h2><p>{profile.experience}</p></section>}
    {contacts.length > 0 && <section className="home-contact" aria-label="联系"><h2>联系</h2><div className="home-contact-links">{contacts.map(renderContact)}</div></section>}
  </div></SiteShell>;
}
