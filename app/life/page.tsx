import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_PROFILE } from "@/lib/content-types";
import { getProfile, listPublicEntries } from "@/lib/server/content";
import { getLifeAccessState } from "@/lib/server/life-auth";
import { SiteShell } from "@/components/public/SiteShell";
import { EntryCard } from "@/components/public/EntryCard";
import { LifeGate } from "@/components/public/LifeGate";
import { LifeLockButton } from "@/components/public/LifeLockButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeReturnTo(value: unknown): string {
  if (value === "/life" || (typeof value === "string" && /^\/entries\/[0-9a-f-]{36}$/i.test(value))) return value as string;
  return "/life";
}

export default async function LifePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  const state = await getLifeAccessState(cookie);
  const profile = (await getProfile()) ?? DEFAULT_PROFILE;
  const query = await searchParams;

  if (!state.unlocked) {
    return <SiteShell profile={profile}><div className="wrap life-page"><Link className="back-link" href="/"><ArrowLeft size={15}/> 回到首页</Link><section className="life-gate-panel">
      <span className="eyebrow">生活记录</span><h1>留给生活的一页</h1><p>生活记录，输入密码后查看。</p>
      {state.configured ? <LifeGate returnTo={safeReturnTo(query.next)} /> : <div className="life-gate-unconfigured"><p>生活访问暂未开放，稍后再来看看。</p></div>}
    </section></div></SiteShell>;
  }

  const entries = await listPublicEntries("life", undefined, true);
  return <SiteShell profile={profile}><div className="wrap listing-page life-page"><div className="life-page-top"><Link className="back-link" href="/"><ArrowLeft size={15}/> 回到首页</Link><LifeLockButton /></div>
    <header className="listing-hero listing-life"><span className="eyebrow">生活记录</span><h1>留给生活的一页</h1><p>生活记录，输入密码后查看。</p><span className="listing-count">{String(entries.length).padStart(2, "0")} 篇记录</span></header>
    {entries.length ? <div className="entry-grid listing-grid">{entries.map((entry, index) => <EntryCard key={entry.id} entry={entry} featured={index === 0}/>)}</div> : <div className="empty-list"><span className="empty-line"/><h2>这里还没有生活记录。</h2><p>写下来的生活片段，会留在这页。</p></div>}
  </div></SiteShell>;
}
