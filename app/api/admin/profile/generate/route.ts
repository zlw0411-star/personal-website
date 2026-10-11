import { error, json, requireAdmin } from "@/lib/server/http";
import { getAdminEntriesByIds } from "@/lib/server/content";
import { generateProfile } from "@/lib/server/profile-generation";

const MAX_BODY_BYTES = 8 * 1024;
export async function POST(request: Request) {
  const denied = await requireAdmin(request, true);
  if (denied) return denied;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return error("请求内容过大。", 413);
  let value: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return error("请求内容过大。", 413);
    value = JSON.parse(raw);
  } catch { return error("请求格式无效，请重试。", 400); }
  if (typeof value !== "object" || value === null || Array.isArray(value) || !Array.isArray((value as Record<string, unknown>).entryIds)) return error("请选择要整理的文章。", 400);
  const ids: unknown[] = (value as { entryIds: unknown[] }).entryIds;
  if (!ids.length) return error("请至少选择一篇文章。", 400);
  if (ids.length > 60) return error("一次最多选择 60 篇文章。", 400);
  if (ids.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)) return error("文章选择列表格式无效。", 400);
  const typedIds = ids as string[];
  if (new Set(typedIds).size !== typedIds.length) return error("文章列表中有重复项，请重新选择。", 400);
  try {
    const entries = await getAdminEntriesByIds(typedIds);
    if (entries.length !== typedIds.length) return error("部分文章已不存在，请刷新列表后重试。", 404);
    return json({ generation: generateProfile(entries) }, 200, { "Vary": "Cookie" });
  } catch { return error("暂时无法整理所选文章，请稍后重试。", 500); }
}
