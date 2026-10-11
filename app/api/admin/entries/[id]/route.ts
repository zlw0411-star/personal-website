import { deleteEntry, getAdminEntry, saveEntry } from "@/lib/server/content";
import { error, json, parseEntry, requireAdmin } from "@/lib/server/http";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(request: Request, ctx: Ctx) { const denied = await requireAdmin(request); if (denied) return denied; try { const entry = await getAdminEntry((await ctx.params).id); return entry ? json({ entry }) : error("Not found", 404); } catch { return error("Unable to load entry", 500); } }
export async function HEAD(request: Request, ctx: Ctx) { const response = await GET(request, ctx); return new Response(null, { status: response.status, headers: response.headers }); }
export async function PUT(request: Request, ctx: Ctx) { const denied = await requireAdmin(request, true); if (denied) return denied; try { const id = (await ctx.params).id; if (!await getAdminEntry(id)) return error("Not found", 404); return json({ entry: await saveEntry(id, parseEntry(await request.json())) }); } catch (e) { return error(e instanceof Error ? e.message : "Invalid entry"); } }
export async function DELETE(request: Request, ctx: Ctx) { const denied = await requireAdmin(request, true); if (denied) return denied; try { await deleteEntry((await ctx.params).id); return json({ ok: true }); } catch { return error("Unable to delete entry", 500); } }
