import { CATEGORIES, type Category } from "@/lib/content-types";
import { listPublicEntries } from "@/lib/server/content";
import { error, json } from "@/lib/server/http";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  const url = new URL(request.url), cat = url.searchParams.get("category"), lim = url.searchParams.get("limit");
  if (cat && !CATEGORIES.includes(cat as Category)) return error("Invalid category");
  if (cat === "life") return error("Not found", 404, headers);
  if (lim && (!/^\d+$/.test(lim) || Number(lim) < 1 || Number(lim) > 100)) return error("Invalid limit");
  try {
    return json({ entries: await listPublicEntries(cat as Category | undefined, lim ? Number(lim) : undefined) }, 200, headers);
  } catch { return error("Unable to load entries", 500, headers); }
}
export async function HEAD(request: Request) { const response = await GET(request); return new Response(null, { status: response.status, headers: response.headers }); }
