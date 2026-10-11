"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="message-page wrap"><span className="eyebrow">A SMALL DETOUR</span><h1>这一页稍微<br/><em>停顿了一下。</em></h1><p>稍后再试一次，内容会继续在这里等你。</p><div className="error-actions"><button className="text-link" onClick={() => reset()}>重新加载 <span>↻</span></button><Link className="text-link" href="/">回到首页 <span>↗</span></Link></div></main>; }
