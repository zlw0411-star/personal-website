"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./admin.module.css";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [loggingOut,setLoggingOut]=useState(false),[logoutError,setLogoutError]=useState("");
  async function logout(){if(loggingOut)return;setLoggingOut(true);setLogoutError("");try{const response=await fetch("/api/admin/auth/logout",{method:"POST"});if(!response.ok)throw Error();window.location.assign("/admin")}catch{setLogoutError("退出失败，请稍后重试。");setLoggingOut(false)}}
  return <div className={styles.frame}>
    <aside className={styles.sidebar}>
      <Link href="/admin" className={styles.brand}><span className={styles.brandMark}>✳</span><span>个人工作台<small>内容管理</small></span></Link>
      <nav aria-label="管理导航" className={styles.nav}>
        <Link className={path === "/admin" || path.startsWith("/admin/entries") ? styles.active : ""} href="/admin">内容管理</Link>
        <Link className={path.startsWith("/admin/profile") ? styles.active : ""} href="/admin/profile">个人资料</Link>
      </nav>
      <Link href="/admin" className={styles.logoutButton} onClick={event=>{event.preventDefault();void logout()}} aria-disabled={loggingOut} aria-label="退出管理员登录">{loggingOut?"正在退出…":"退出管理"}</Link>
      {logoutError&&<p role="alert" className={styles.logoutError}>{logoutError}</p>}
      <p className={styles.sideNote}>在这里整理想法，慢慢搭建属于自己的空间。</p>
      <Link className={styles.siteLink} href="/">← 返回网站</Link>
    </aside>
    <main className={styles.main}>{children}</main>
  </div>;
}
