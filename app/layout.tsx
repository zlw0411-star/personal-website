import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "关于我 · 一页日常", template: "%s · 关于我" },
  description: "记录生活，保持好奇，慢慢成长。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
