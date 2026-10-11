"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORY_INFO, type Category, type EntrySummary, formatDate } from "@/lib/content-types";
import styles from "./admin.module.css";

type CategoryTab = "all" | "learning" | "life";

export default function EntryList() {
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<CategoryTab>("all");
  const [state, setState] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [search, setSearch] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const busyIdsRef = useRef(new Set<string>());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const response = await fetch("/api/admin/entries");
      const data = await response.json() as { entries?: EntrySummary[]; error?: string };
      if (!response.ok) throw new Error(data.error || "暂时无法读取内容，请重试。");
      setEntries(data.entries || []);
    } catch (cause) {
      setLoadFailed(true);
      setError(cause instanceof Error ? cause.message : "暂时无法读取内容，请重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entries
      .filter((entry) => category === "all" || (category === "life" ? entry.category === "life" : entry.category === "learning" || entry.category === "project"))
      .filter((entry) => state === "all" || entry.status === state)
      .filter((entry) => visibility === "all" || (entry.category === "life" ? visibility === "private" : entry.visibility === visibility))
      .filter((entry) => !query || `${entry.title} ${entry.summary}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [entries, category, state, visibility, search]);

  async function remove(entry: EntrySummary) {
    if (busyIdsRef.current.has(entry.id)) return;
    if (!window.confirm(`确定删除「${entry.title || "未命名内容"}」吗？此操作无法撤销。`)) return;
    busyIdsRef.current.add(entry.id);
    setBusyIds(new Set(busyIdsRef.current));
    setError("");
    try {
      const response = await fetch(`/api/admin/entries/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "删除失败，请稍后重试。");
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败，请稍后重试。");
    } finally {
      busyIdsRef.current.delete(entry.id);
      setBusyIds(new Set(busyIdsRef.current));
    }
  }

  return <>
    <header className={styles.pageHead}>
      <div>
        <p className={styles.eyebrow}>管理入口</p>
        <h1 className={styles.title}>内容管理</h1>
        <p className={styles.subtitle}>管理个人资料，整理经历与生活记录。</p>
      </div>
    </header>

    <nav className={styles.quickLinks} aria-label="快捷操作">
      <Link className={styles.quickCard} href="/admin/profile">
        <span className={styles.eyebrow}>个人资料</span>
        <strong>编辑个人资料</strong>
        <span>更新首页显示的简介、头像和链接。</span>
      </Link>
      <Link className={styles.quickCard} href="/admin/entries/new?category=learning">
        <span className={styles.eyebrow}>求学 · 实习 · 工作</span>
        <strong>新增经历</strong>
        <span>记录时间、学校或单位，以及具体内容。</span>
      </Link>
      <Link className={styles.quickCard} href="/admin/entries/new?category=life">
        <span className={styles.eyebrow}>密码保护</span>
        <strong>写生活记录</strong>
        <span>写下日常点滴，生活栏目会要求密码解锁。</span>
      </Link>
    </nav>

    <div className={styles.sectionHead}>
      <div>
        <h2>文章列表</h2>
        <p>搜索标题或摘要，按分类和状态筛选。</p>
      </div>
      <span className={styles.muted}>{filtered.length} 篇</span>
    </div>

    {error && <div role="alert" className={styles.error}>{error}{loadFailed && <button className={styles.textButton} type="button" onClick={() => void load()}>重试</button>}</div>}

    <div className={styles.filterTabs} role="group" aria-label="内容分类">
      {([ ["all", "全部"], ["learning", "经历"], ["life", "生活"] ] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={category === value} className={category === value ? styles.toolSelected : styles.tool} onClick={() => setCategory(value)}>{label}</button>
      )}
    </div>

    <div className={styles.filters}>
      <label>
        <span className={styles.muted}>搜索</span>
        <input className={styles.searchInput} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="标题或摘要" aria-label="搜索标题或摘要" />
      </label>
      <label>
        <span className={styles.muted}>状态</span>
        <select aria-label="发布状态" className={styles.select} value={state} onChange={(event) => setState(event.target.value)}>
          <option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option>
        </select>
      </label>
      <label>
        <span className={styles.muted}>可见范围</span>
        <select aria-label="可见范围" className={styles.select} value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="all">全部范围</option><option value="public">公开</option><option value="private">仅自己 / 密码保护</option>
        </select>
      </label>
    </div>

    {loading ? <div className={`${styles.panel} ${styles.empty}`} aria-live="polite">正在载入内容…</div>
      : loadFailed ? null
      : filtered.length === 0 ? <div className={`${styles.panel} ${styles.empty}`}>
        <h2>{entries.length ? "没有符合条件的内容" : "还没有文章记录"}</h2>
        <p>{entries.length ? "试试调整分类、搜索词或筛选条件。" : "可以先补充经历，或写下一段生活记录。"}</p>
        {!entries.length && <div className={styles.cardActions}>
          {(category === "all" || category === "learning") && <Link className={`${styles.button} ${styles.primary}`} href="/admin/entries/new?category=learning">新增经历</Link>}
          {(category === "all" || category === "life") && <Link className={styles.button} href="/admin/entries/new?category=life">写生活记录</Link>}
        </div>}
      </div> : <div className={styles.cardGrid}>
        {filtered.map((entry) => {
          const categoryLabel = CATEGORY_INFO[entry.category as Category]?.label || "文章";
          const visibilityLabel = entry.category === "life" ? "密码保护" : entry.visibility === "public" ? "公开" : "仅自己";
          const deleting = busyIds.has(entry.id);
          const editHref = `/admin/entries/${encodeURIComponent(entry.id)}`;
          return <article className={styles.listCard} key={entry.id}>
            <div className={styles.listMeta}>
              <span>{categoryLabel}</span>
              <span className={styles.statusBadge} data-status={entry.status}>{entry.status === "published" ? "已发布" : "草稿"}</span>
              <span className={styles.visibilityBadge} data-visibility={visibilityLabel === "公开" ? "public" : "private"}>{visibilityLabel}</span>
            </div>
            <h3><Link className={styles.entryTitle} href={editHref}>{entry.title || "未命名内容"}</Link></h3>
            <p className={styles.entryMeta}>{entry.summary || "暂无摘要"}</p>
            <p className={styles.muted}>更新于 {formatDate(entry.updatedAt)}</p>
            <div className={styles.cardActions}>
              <Link className={styles.button} href={editHref}>编辑</Link>
              <button className={`${styles.button} ${styles.danger}`} type="button" disabled={deleting} onClick={() => void remove(entry)}>
                {deleting ? "正在删除…" : "删除"}
              </button>
            </div>
          </article>;
        })}
      </div>}
  </>;
}
