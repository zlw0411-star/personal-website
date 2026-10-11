export const CATEGORIES = ["life", "learning", "project"] as const;
export const EDITABLE_CATEGORIES = ["learning", "life"] as const;
export type Category = (typeof CATEGORIES)[number];
export type PublishStatus = "draft" | "published";
export type Visibility = "public" | "private";
export type Contact = { kind: "email" | "phone" | "link" | "text"; label: string; value: string };
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
export type RichDoc = RichNode & { type: "doc" };
export type EntryInput = {
  category: Category;
  title: string;
  summary: string;
  body: RichDoc;
  coverId: string | null;
  status: PublishStatus;
  visibility: Visibility;
  projectUrl: string;
  repositoryUrl: string;
};
export type Entry = EntryInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};
export type EntrySummary = Omit<Entry, "body">;
export type Profile = {
  siteName: string;
  nickname: string;
  bio: string;
  about: string;
  experience: string;
  avatarId: string | null;
  email: string;
  links: { label: string; url: string }[];
  contacts: Contact[];
};
export type ProfileGeneration = {
  about: string;
  experience: string;
  sources: { id: string; title: string; category: Category; status: PublishStatus; visibility: Visibility }[];
  counts: { experience: number; life: number };
  omittedCount: number;
  weights: { experience: 3; life: 1 };
};
export type MediaUpload = { id: string; url: string; adminUrl: string };
export const EMPTY_DOC: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };
export const DEFAULT_PROFILE: Profile = {
  siteName: "关于我", nickname: "你的昵称", bio: "记录生活，保持好奇，慢慢成长。",
  about: "这里将放下我的故事、兴趣，以及正在探索的方向。", experience: "",
  avatarId: null, email: "", links: [], contacts: [],
};
export function profileContacts(profile: Pick<Profile, "contacts" | "email" | "links">): Contact[] {
  const result: Contact[] = [], seen = new Set<string>();
  const add = (contact: Contact) => {
    const value = contact.value.trim();
    if (!value) return;
    let normalized = value;
    if (contact.kind === "email") normalized = value.toLocaleLowerCase();
    else if (contact.kind === "phone") normalized = value.replace(/[\s().-]/g, "");
    const key = `${contact.kind}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ kind: contact.kind, label: contact.label.trim(), value });
  };
  for (const contact of profile.contacts ?? []) add(contact);
  if (profile.email) add({ kind: "email", label: "邮箱", value: profile.email });
  for (const link of profile.links ?? []) {
    const value = link.url.trim();
    if (/^https?:\/\//i.test(value)) { add({ kind: "link", label: link.label, value }); continue; }
    if (/^mailto:/i.test(value)) {
      try {
        const parsed = new URL(value);
        const mailbox = decodeURIComponent(parsed.pathname);
        if (!parsed.search && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox)) add({ kind: "email", label: link.label, value: mailbox });
        else add({ kind: "text", label: link.label, value });
      } catch { add({ kind: "text", label: link.label, value }); }
      continue;
    }
    add({ kind: "text", label: link.label, value });
  }
  return result;
}
export const CATEGORY_INFO: Record<Category, { label: string; path: string; description: string }> = {
  life: { label: "生活", path: "/life", description: "记录日常生活，内容受密码保护。" },
  learning: { label: "经历", path: "/experience", description: "记录求学、实习、工作，以及其中的项目。" },
  project: { label: "经历", path: "/experience", description: "记录求学、实习、工作，以及其中的项目。" },
};
export function mediaUrl(id: string, admin = false): string {
  return `/api/${admin ? "admin/" : ""}media/${encodeURIComponent(id)}`;
}
export function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Shanghai" }).format(new Date(value)) : "尚未发布";
}
