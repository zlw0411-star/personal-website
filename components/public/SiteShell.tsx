import Link from "next/link";
import type { Profile } from "@/lib/content-types";
import { DEFAULT_PROFILE } from "@/lib/content-types";

export function SiteShell({ children, profile = DEFAULT_PROFILE }: { children: React.ReactNode; profile?: Profile }) {
  const isDevelopment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  return <><header className="site-header"><div className="header-inner"><Link className="brand" href="/" aria-label={`${profile.siteName}，首页`}><span className="brand-mark">{profile.nickname.slice(0, 1) || "我"}</span><span>{profile.siteName}</span></Link><nav className="main-nav" aria-label="主导航"><Link href="/">首页</Link><Link href="/experience">经历</Link><Link href="/life">生活</Link></nav></div></header><main>{children}</main><footer className="site-footer"><div className="footer-inner"><span>慢慢记录，慢慢成为。</span><span>© {new Date().getFullYear()} {profile.nickname}</span>{isDevelopment && <Link className="footer-admin-link" href="/admin">管理内容</Link>}</div></footer></>;
}
