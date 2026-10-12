import { getPublicEntry } from "@/lib/server/content";
import { error, json } from "@/lib/server/http";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const entry = await getPublicEntry(id);
    return entry ? json({ entry }, 200, headers) : error("Not found", 404, headers);
  } catch { return error("Unable to load entry", 500, headers); }
}
export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) { const response = await GET(request, context); return new Response(null, { status: response.status, headers: response.headers }); }
