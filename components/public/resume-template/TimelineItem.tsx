import { SiteLink } from "@/components/public/SiteLink";
import { ArrowUpRight } from "lucide-react";
import type { Entry } from "@/lib/content-types";
import { formatDate } from "@/lib/content-types";

/**
 * Adapted from the MIT-licensed React Resume Template.
 * Source: src/components/Sections/Resume/TimelineItem.tsx
 * Upstream: 49ce16c0dd1b382edc1ec2cef6120345776d19b9
 * Full license: vendor/react-resume-template/LICENSE
 */
export default function TimelineItem({ entry }: { entry: Entry }) {
  return <SiteLink className="rr-timeline-item" href={`/entries/${encodeURIComponent(entry.id)}`}>
    <span className="rr-timeline-date">发布于 · <time dateTime={entry.publishedAt ?? undefined}>{formatDate(entry.publishedAt)}</time></span>
    <h3>
      <span>{entry.title}</span>
      <ArrowUpRight aria-hidden="true" size={18} />
    </h3>
    {entry.summary.trim() && <p>{entry.summary}</p>}
  </SiteLink>;
}
