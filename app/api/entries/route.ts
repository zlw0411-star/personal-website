import { CATEGORIES, type Category } from "@/lib/content-types";
import { listPublicEntries } from "@/lib/server/content";
import { isLifeUnlocked } from "@/lib/server/life-auth";
import { error, json } from "@/lib/server/http";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  const url = new URL(request.url), cat = url.searchParams.get("category"), lim = url.searchParams.get("limit");
  if (cat && !CATEGORIES.includes(cat as Category)) return error("Invalid category");
  if (lim && (!/^\d+$/.test(lim) || Number(lim) < 1 || Number(lim) > 100)) return error("Invalid limit");
  try {
    const allowLife = await isLifeUnlocked(request.headers.get("cookie"));
    if (cat === "life" && !allowLife) return error("请先解锁生活栏目。", 401, headers);
    return json({ entries: await listPublicEntries(cat as Category | undefined, lim ? Number(lim) : undefined, allowLife) }, 200, headers);
  } catch { return error("Unable to load entries", 500, headers); }
}
export async function HEAD(request: Request) { const response = await GET(request); return new Response(null, { status: response.status, headers: response.headers }); }
