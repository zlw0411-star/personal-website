import type { RichDoc, RichNode } from "@/lib/content-types";
import { mediaUrl } from "@/lib/content-types";

function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^(https?:|mailto:|tel:)/i.test(v) || v.startsWith("/") && !v.startsWith("//") || v.startsWith("#")) return v;
  return null;
}
function inline(node: RichNode, key: number): React.ReactNode {
  if (node.type === "text") {
    let child: React.ReactNode = node.text ?? "";
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold" || mark.type === "strong") child = <strong key={`${key}-b`}>{child}</strong>;
      else if (mark.type === "italic" || mark.type === "em") child = <em key={`${key}-i`}>{child}</em>;
      else if (mark.type === "strike") child = <del key={`${key}-d`}>{child}</del>;
      else if (mark.type === "underline") child = <u key={`${key}-u`}>{child}</u>;
      else if (mark.type === "code") child = <code key={`${key}-c`}>{child}</code>;
      else if (mark.type === "link") { const href = safeHref(mark.attrs?.href); if (href) child = <a key={`${key}-a`} href={href} rel={/^https?:/i.test(href) ? "noreferrer noopener" : undefined}>{child}</a>; }
    }
    return <span key={key}>{child}</span>;
  }
  if (node.type === "hardBreak") return <br key={key} />;
  return <>{(node.content ?? []).map((n, i) => inline(n, i))}</>;
}
function block(node: RichNode, key: number, admin: boolean): React.ReactNode {
  const children = (node.content ?? []).map((n, i) => n.type === "text" || n.type === "hardBreak" ? inline(n, i) : block(n, i, admin));
  switch (node.type) {
    case "paragraph": return <p key={key}>{children}</p>;
    case "heading": { const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 2)); const Tag = `h${level}` as "h1" | "h2" | "h3"; return <Tag key={key}>{children}</Tag>; }
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock": return <pre key={key}><code>{(node.content ?? []).map(n => n.text ?? "").join("")}</code></pre>;
    case "image": { const id = node.attrs?.mediaId; return typeof id === "string" ? <figure key={key}><img src={mediaUrl(id, admin)} alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : ""} /></figure> : null; }
    case "horizontalRule": return <hr key={key} />;
    default: return <>{children}</>;
  }
}
export function RichText({ doc, admin = false }: { doc: RichDoc; admin?: boolean }) {
  return <div className={`rich-text${admin ? " rich-text-admin" : ""}`}>{(doc.content ?? []).map((n, i) => block(n, i, admin))}</div>;
}
