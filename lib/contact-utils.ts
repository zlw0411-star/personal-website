import type { Contact } from "./content-types";

type RecordValue = Record<string, unknown>;
function isRecord(value: unknown): value is RecordValue { return typeof value === "object" && value !== null && !Array.isArray(value); }
function contactText(value: unknown, max: number, field: string): string {
  if (typeof value !== "string" || value.length > max) throw new Error(`${field}格式或长度不正确。`);
  return value.trim();
}
function validateEmail(value: string) {
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("邮箱格式不正确。");
}
function validatePhone(value: string) {
  if (!/[0-9]/.test(value) || !/^\+?[0-9().\-\s]+$/.test(value)) throw new Error("电话仅支持数字、空格及 + ( ) . - 符号，+ 号需放在开头。");
}
function validateLink(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("联系方式链接格式不正确。"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("联系方式链接仅支持 http 或 https 协议。");
}

export function parseContacts(value: unknown): Contact[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error("联系方式最多填写 30 项。");
  const contacts: Contact[] = [];
  for (const item of value) {
    if (!isRecord(item)) throw new Error("联系方式格式无效。");
    const label = contactText(item.label ?? "", 80, "联系方式名称");
    const contactValue = contactText(item.value ?? "", 2048, "联系方式");
    if (!label && !contactValue) continue;
    if (!label || !contactValue) throw new Error("联系方式名称和值都需要填写，或整行留空。");
    if (typeof item.kind !== "string" || !["email", "phone", "link", "text"].includes(item.kind)) throw new Error("请选择有效的联系方式类型。");
    if (item.kind === "email") validateEmail(contactValue);
    else if (item.kind === "phone") validatePhone(contactValue);
    else if (item.kind === "link") validateLink(contactValue);
    contacts.push({ kind: item.kind as Contact["kind"], label, value: contactValue });
  }
  return contacts;
}
