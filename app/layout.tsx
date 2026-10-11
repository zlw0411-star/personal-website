import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "个人作品集", template: "%s · 个人作品集" },
  description: "记录我的项目、学习经历与持续成长。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
