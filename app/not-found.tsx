import Link from "next/link";
import { SiteShell } from "@/components/public/SiteShell";
export default function NotFound() { return <SiteShell><div className="wrap message-page"><span className="eyebrow">404 · PAGE NOT FOUND</span><h1>这页暂时<br/><em>还没有抵达。</em></h1><p>可能它已经搬走了，也可能你走进了一条还没写下的路。</p><Link className="text-link" href="/">回到首页 <span>↗</span></Link></div></SiteShell>; }
