/**
 * Contact list layout is adapted from the MIT-licensed React Resume Template.
 * Source grid: src/components/Sections/About.tsx
 * Upstream: 49ce16c0dd1b382edc1ec2cef6120345776d19b9
 * Link validation and rendering retain the existing app/page.tsx safeguards.
 * Full template license: vendor/react-resume-template/LICENSE
 */
import { ArrowUpRight, AtSign, Phone } from "lucide-react";
import { profileContacts, type Contact, type Profile } from "@/lib/content-types";

function renderContact(contact: Contact, index: number) {
  const label = contact.label.trim() || contact.value.trim();
  const value = contact.value.trim();
  const labeledValue = label !== value ? `${label}：${value}` : value;
  const key = `${contact.kind}-${value}-${index}`;
  if (!value) return null;
  if (contact.kind === "email" && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
    return <a key={key} href={`mailto:${encodeURIComponent(value).replace("%40", "@")}`}><AtSign size={16} aria-hidden="true" /><span className="rr-contact-value">{labeledValue}</span><ArrowUpRight size={14} aria-hidden="true" /></a>;
  }
  if (contact.kind === "phone" && /^\+?[\d\s().-]+$/.test(value) && (value.match(/\d/g)?.length ?? 0) > 0) {
    const dial = value.replace(/[^\d+]/g, "");
    return <a key={key} href={`tel:${dial}`}><Phone size={16} aria-hidden="true" /><span className="rr-contact-value">{labeledValue}</span><ArrowUpRight size={14} aria-hidden="true" /></a>;
  }
  if (contact.kind === "link") {
    let safeUrl: string | null = null;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") safeUrl = parsed.href;
    } catch { /* Render malformed legacy values as plain text. */ }
    if (safeUrl) return <a key={key} href={safeUrl} target="_blank" rel="noopener noreferrer"><span className="rr-contact-value">{label}</span><ArrowUpRight size={14} aria-hidden="true" /></a>;
  }
  return <span className="rr-contact-text" style={{ overflowWrap: "anywhere" }} key={key}>{labeledValue}</span>;
}

export function ProfileContacts({ profile, headingLevel = 3 }: { profile: Profile; headingLevel?: 2 | 3 }) {
  const contacts = profileContacts(profile).filter(contact => contact.value.trim());
  if (contacts.length === 0) return null;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return <div className="rr-contacts">
    <Heading id="rr-contacts-title" className="rr-contacts-title">联系方式</Heading>
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 rr-profile-contacts">
      {contacts.map((contact, index) => <li className="col-span-1 flex items-start gap-x-2 rr-profile-contact" key={`${contact.kind}-${contact.value}-${index}`}>
        {renderContact(contact, index)}
      </li>)}
    </ul>
  </div>;
}
