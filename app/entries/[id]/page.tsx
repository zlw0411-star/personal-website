import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { DEFAULT_PROFILE, formatDate, CATEGORY_INFO } from "@/lib/content-types";
import { getEntryAccessKind, getProfile, getPublicEntry } from "@/lib/server/content";
import { isLifeUnlocked } from "@/lib/server/life-auth";
import { SiteShell } from "@/components/public/SiteShell";
import { RichText } from "@/components/public/RichText";
import { LifeLockButton } from "@/components/public/LifeLockButton";
export const dynamic = "force-dynamic";
export const revalidate = 0;
function safeUrl(url: string) { return /^https?:\/\//i.test(url) ? url : null; }
export default async function EntryDetail({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const kind = await getEntryAccessKind(id);
 if (!kind) notFound();
 let allowLife = false;
 if (kind === "life") {
  const requestHeaders = await headers();
  allowLife = await isLifeUnlocked(requestHeaders.get("cookie"));
  if (!allowLife) redirect(`/life?next=${encodeURIComponent(`/entries/${id}`)}`);
 }
 const [entry, profile] = await Promise.all([getPublicEntry(id, allowLife), getProfile()]);
 if (!entry) notFound();
 const category = CATEGORY_INFO[entry.category];
 return <SiteShell profile={profile ?? DEFAULT_PROFILE} currentSection={entry.category === "life" ? "life" : "experience"}><article className="wrap article-page"><div className="article-nav"><Link className="back-link" href={category.path}><ArrowLeft size={15}/> {category.label}</Link>{entry.category === "life" && <LifeLockButton />}</div><header className="article-head"><span className="eyebrow">{category.label} <i>·</i> {formatDate(entry.publishedAt)}</span><h1>{entry.title}</h1>{entry.summary && <p className="article-summary">{entry.summary}</p>}</header>{entry.coverId && <figure className="article-cover"><img src={`/api/media/${encodeURIComponent(entry.coverId)}`} alt=""/></figure>}<RichText doc={entry.body}/>{entry.category !== "life" && (safeUrl(entry.projectUrl) || safeUrl(entry.repositoryUrl)) && <div className="project-links">{safeUrl(entry.projectUrl) && <a href={safeUrl(entry.projectUrl)!} rel="noreferrer noopener">查看项目 <ArrowUpRight size={16}/></a>}{safeUrl(entry.repositoryUrl) && <a href={safeUrl(entry.repositoryUrl)!} rel="noreferrer noopener">源代码 <ArrowUpRight size={16}/></a>}</div>}<footer className="article-end"><span>写于 {formatDate(entry.publishedAt)}</span><Link href="/">回到首页 <ArrowUpRight size={15}/></Link></footer></article></SiteShell>;
}
