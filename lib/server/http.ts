import { CATEGORIES, type EntryInput, type Profile, type RichDoc, type RichNode } from "@/lib/content-types";
import { isAdminAuthenticated } from "@/lib/server/admin-auth";
import { parseContacts } from "@/lib/contact-utils";

export function json(data: unknown, status = 200, headers: HeadersInit = {}) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } }); }
export function error(message: string, status = 400, headers: HeadersInit = {}) { return json({ error: message }, status, headers); }
export function adminAllowed(request: Request) {
  const dev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  if (!dev) return false;
  try { return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(request.url).hostname); } catch { return false; }
}
export function adminMutationAllowed(request: Request) {
  return adminAllowed(request) && sameOriginMutation(request);
}
export function sameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return false;
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}
export function requireLocalAdmin(request: Request, mutation = false): Response | null {
  if (!adminAllowed(request)) return error("Not found", 404);
  if (mutation && !adminMutationAllowed(request)) return error("Forbidden", 403);
  return null;
}
export async function requireAdmin(request: Request, mutation = false): Promise<Response | null> {
  const local = requireLocalAdmin(request, mutation);
  if (local) return local;
  if (!await isAdminAuthenticated(request.headers.get("cookie"))) return error("管理登录已过期或尚未登录，请在新标签页登录后台后再试。", 401, { Vary: "Cookie" });
  return null;
}
const maxLen: Record<string, number> = { siteName: 100, nickname: 100, bio: 500, about: 10000, experience: 10000, email: 254, title: 200, summary: 1000, projectUrl: 2048, repositoryUrl: 2048, label: 80, url: 2048 };
const fieldLabel: Record<string, string> = { siteName: "网站名称", nickname: "昵称", bio: "简介", about: "关于内容", experience: "经历", email: "邮箱", title: "标题", summary: "摘要", projectUrl: "项目链接", repositoryUrl: "仓库链接", label: "链接名称", url: "链接地址" };
type RecordValue = Record<string, unknown>;
function isRecord(value: unknown): value is RecordValue { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, key: string, optional = false): string {
  if (typeof value !== "string" || (!optional && !value.trim()) || value.length > (maxLen[key] ?? 10000)) throw new Error(`请检查${fieldLabel[key] ?? "输入内容"}，不能为空且长度需符合限制。`);
  return value;
}
function httpUrl(value: string, allowMail = false) {
  if (!value) return;
  let url: URL; try { url = new URL(value); } catch { throw new Error("链接格式不正确。"); }
  if (!(url.protocol === "http:" || url.protocol === "https:" || (allowMail && url.protocol === "mailto:"))) throw new Error("链接仅支持 http、https 或 mailto 协议。");
}
const nodeTypes = new Set(["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "hardBreak", "horizontalRule", "image"]);
const markTypes = new Set(["bold", "italic", "strike", "underline", "code", "link"]);
function record(value: unknown, message: string): RecordValue {
  if (!isRecord(value)) throw new Error(message);
  return value;
}
export function sanitizeDoc(value: unknown): RichDoc {
  let count = 0, totalText = 0;
  const walk = (item: unknown, depth: number): RichNode => {
    if (++count > 2000 || depth > 32) throw new Error("富文本内容过于复杂。");
    const node = record(item, "富文本内容格式无效。");
    if (typeof node.type !== "string" || !nodeTypes.has(node.type)) throw new Error("富文本中包含不支持的内容。");
    const attrs = node.attrs === undefined ? undefined : record(node.attrs, "富文本节点属性无效。");
    const out: RichNode = { type: node.type };
    if (node.type === "text") {
      out.text = text(node.text, "document text", true); totalText += out.text.length;
      if (totalText > 100000) throw new Error("富文本内容过长。");
    }
    if (attrs) out.attrs = {};
    if (node.type === "heading") { const level = Number(attrs?.level); if (![1, 2, 3].includes(level)) throw new Error("标题级别只能选择 1 至 3。"); out.attrs = { ...(out.attrs ?? {}), level }; }
    if (node.type === "orderedList" && attrs?.start !== undefined) { const start = Number(attrs.start); if (!Number.isInteger(start) || start < 1 || start > 10000) throw new Error("列表编号无效。"); out.attrs = { ...(out.attrs ?? {}), start }; }
    if (node.type === "image") {
      const id = typeof attrs?.mediaId === "string" ? attrs.mediaId : typeof attrs?.src === "string" ? attrs.src.match(/^\/api\/(?:admin\/)?media\/([0-9a-f-]{36})$/i)?.[1] : undefined;
      if (!id) throw new Error("图片必须来自本站已上传的媒体文件。");
      const dims: Record<string, number> = {};
      for (const key of ["width", "height"]) if (attrs?.[key] !== undefined && attrs[key] !== null) { const size = Number(attrs[key]); if (!Number.isInteger(size) || size < 1 || size > 4096) throw new Error("图片尺寸无效。"); dims[key] = size; }
      out.attrs = { mediaId: id, src: `/api/media/${id}`, ...dims, ...(typeof attrs?.alt === "string" ? { alt: text(attrs.alt, "image alt", true) } : {}) };
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > 8) throw new Error("文本格式标记无效。");
      out.marks = node.marks.map((value): NonNullable<RichNode["marks"]>[number] => {
        const mark = record(value, "文本格式标记无效。");
        if (typeof mark.type !== "string" || !markTypes.has(mark.type)) throw new Error("富文本中包含不支持的格式。");
        if (mark.type === "link") {
          const linkAttrs = mark.attrs === undefined ? {} : record(mark.attrs, "链接属性无效。");
          const href = text(linkAttrs.href, "url"); httpUrl(href, true); return { type: "link", attrs: { href } };
        }
        return { type: mark.type };
      });
    }
    if (node.content !== undefined) { if (!Array.isArray(node.content)) throw new Error("富文本内容格式无效。"); out.content = node.content.map((child: unknown) => walk(child, depth + 1)); }
    return out;
  };
  const doc = walk(value, 0) as RichDoc;
  if (doc.type !== "doc") throw new Error("富文本根节点必须是文档。");
  return doc;
}
export function parseEntry(value: unknown): EntryInput {
  const v = record(value, "文章数据格式无效。");
  if (typeof v.category !== "string" || !CATEGORIES.includes(v.category as EntryInput["category"]) || (v.status !== "draft" && v.status !== "published") || (v.visibility !== "public" && v.visibility !== "private")) throw new Error("请选择有效的分类、发布状态和可见范围。");
  const title = text(v.title, "title"), summary = text(v.summary ?? "", "summary", true), projectUrl = text(v.projectUrl ?? "", "projectUrl", true), repositoryUrl = text(v.repositoryUrl ?? "", "repositoryUrl", true);
  httpUrl(projectUrl); httpUrl(repositoryUrl);
  const coverId = v.coverId === null || v.coverId === "" ? null : text(v.coverId, "coverId");
  const category = v.category === "project" ? "learning" : v.category as EntryInput["category"];
  return { category, status: v.status, visibility: category === "life" ? "private" : v.visibility, title, summary, projectUrl, repositoryUrl, coverId, body: sanitizeDoc(v.body) };
}
export function parseProfile(value: unknown): Profile {
  const v = record(value, "个人资料格式无效。");
  const fields = { siteName: text(v.siteName, "siteName"), nickname: text(v.nickname, "nickname"), bio: text(v.bio, "bio", true), about: text(v.about, "about", true), experience: text(v.experience ?? "", "experience", true), avatarId: v.avatarId === null || v.avatarId === "" ? null : text(v.avatarId, "avatarId"), email: text(v.email ?? "", "email", true) };
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw new Error("邮箱格式不正确。");
  if (!Array.isArray(v.links) || v.links.length > 30) throw new Error("链接数量不能超过 30 个。");
  const links = v.links.map((value: unknown) => { const link = record(value, "个人链接格式无效。"); const label = text(link.label, "label"), url = text(link.url, "url"); httpUrl(url, true); return { label, url }; });
  const contacts = parseContacts(v.contacts === undefined ? [] : v.contacts);
  return { ...fields, links, contacts };
}
