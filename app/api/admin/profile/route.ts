import { getProfile, upsertProfile } from "@/lib/server/content";
import { error, json, parseProfile, requireAdmin } from "@/lib/server/http";
export async function GET(request: Request) { const denied = await requireAdmin(request); if (denied) return denied; try { return json({ profile: await getProfile() }); } catch { return error("Unable to load profile", 500); } }
export async function HEAD(request: Request) { const response = await GET(request); return new Response(null, { status: response.status, headers: response.headers }); }
export async function PUT(request: Request) {
  const denied = await requireAdmin(request, true); if (denied) return denied;
  const length = Number(request.headers.get("content-length") ?? 0); if (length > 256 * 1024) return error("请求内容过大。", 413);
  try {
    const value: unknown = await request.json();
    const current = await getProfile();
    const merged = typeof value === "object" && value !== null && !Array.isArray(value) && !Object.hasOwn(value, "contacts")
      ? { ...value, contacts: current.contacts }
      : value;
    return json({ profile: await upsertProfile(parseProfile(merged)) });
  } catch (e) { return error(e instanceof Error ? e.message : "Invalid profile"); }
}
