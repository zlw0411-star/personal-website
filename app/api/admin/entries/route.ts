import { createEntry, listAdminEntries, saveEntry } from "@/lib/server/content";
import type { EntryInput } from "@/lib/content-types";
import { error, json, parseEntry, requireAdmin } from "@/lib/server/http";
export async function GET(request: Request) { const denied = await requireAdmin(request); if (denied) return denied; try { return json({ entries: await listAdminEntries() }); } catch { return error("Unable to load entries", 500); } }
export async function HEAD(request: Request) { const response = await GET(request); return new Response(null, { status: response.status, headers: response.headers }); }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const createId = request.headers.get("Idempotency-Key");
  if (createId !== null && !uuidPattern.test(createId)) return error("文章创建编号无效。", 400);
  const denied = await requireAdmin(request, true);
  if (denied) return denied;
  let input: EntryInput;
  try { input = parseEntry(await request.json()); }
  catch (e) { return error(e instanceof Error ? e.message : "Invalid entry", 400); }
  try {
    if (createId === null) return json({ entry: await saveEntry(null, input) }, 201);
    const result = await createEntry(createId, input);
    return json({ entry: result.entry }, result.created ? 201 : 200);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ENTRY_CREATE_CONFLICT") return error("该创建编号已用于另一篇内容，请重新尝试保存。", 409);
    if (e && typeof e === "object" && "code" in e && e.code === "ENTRY_INVALID_MEDIA") return error("文章引用的图片已失效，请重新选择图片后保存。", 400);
    return error("暂时无法保存文章，请稍后重试。", 500);
  }
}
