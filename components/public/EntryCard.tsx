import { SiteLink } from "@/components/public/SiteLink";
import type { Entry } from "@/lib/content-types";
import { formatDate, mediaUrl } from "@/lib/content-types";
export function EntryCard({ entry, featured = false }: { entry: Entry; featured?: boolean }) {
 const className = `entry-card${featured ? " entry-card-featured" : ""}`;
 const content = <>
  {entry.coverId ? <div className="entry-cover"><img src={mediaUrl(entry.coverId)} alt="" /></div> : null}
  <div className="entry-card-copy"><div className="entry-meta"><span>{formatDate(entry.publishedAt)}</span><span aria-hidden="true">↗</span></div><h3>{entry.title}</h3>{entry.summary && <p>{entry.summary}</p>}</div>
 </>;
 return <SiteLink className={className} href={`/entries/${encodeURIComponent(entry.id)}`}>{content}</SiteLink>;
}
