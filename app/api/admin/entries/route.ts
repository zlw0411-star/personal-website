import { listAdminEntries, saveEntry } from "@/lib/server/content";
import { error, json, parseEntry, requireAdmin } from "@/lib/server/http";
export async function GET(request: Request) { const denied = await requireAdmin(request); if (denied) return denied; try { return json({ entries: await listAdminEntries() }); } catch { return error("Unable to load entries", 500); } }
export async function HEAD(request: Request) { const response = await GET(request); return new Response(null, { status: response.status, headers: response.headers }); }
export async function POST(request: Request) { const denied = await requireAdmin(request, true); if (denied) return denied; try { const entry = await saveEntry(null, parseEntry(await request.json())); return json({ entry }, 201); } catch (e) { return error(e instanceof Error ? e.message : "Invalid entry"); } }
