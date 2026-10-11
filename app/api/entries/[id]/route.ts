import { getEntryAccessKind, getPublicEntry } from "@/lib/server/content";
import { isLifeUnlocked } from "@/lib/server/life-auth";
import { error, json } from "@/lib/server/http";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const kind = await getEntryAccessKind(id);
    if (!kind) return error("Not found", 404, headers);
    const allowLife = await isLifeUnlocked(_request.headers.get("cookie"));
    if (kind === "life" && !allowLife) return error("Not found", 404, headers);
    const entry = await getPublicEntry(id, allowLife);
    return entry ? json({ entry }, 200, headers) : error("Not found", 404, headers);
  } catch { return error("Unable to load entry", 500, headers); }
}
export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) { const response = await GET(request, context); return new Response(null, { status: response.status, headers: response.headers }); }
