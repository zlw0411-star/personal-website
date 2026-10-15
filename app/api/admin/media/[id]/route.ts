import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { entryMedia, media, profile } from "@/db/schema";
import { error, json, requireAdmin } from "@/lib/server/http";
import { getMediaStore } from "@/lib/server/media-store";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const store = getMediaStore(env.MEDIA);
    const [row] = await getDb().select().from(media).where(eq(media.id, (await context.params).id)).limit(1);
    if (!row || !store) return error("Not found", 404);
    const object = await store.get(row.objectKey); if (!object) return error("Not found", 404);
    return new Response(object, { headers: { "Content-Type": row.mimeType, "Content-Length": String(row.size), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return error("Unable to load media", 500); }
}
export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) { const response = await GET(request, context); return new Response(null, { status: response.status, headers: response.headers }); }
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request, true); if (denied) return denied;
  try {
    const db = getDb(), id = (await context.params).id, store = getMediaStore(env.MEDIA);
    const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row) return error("Not found", 404);
    const [entryRef] = await db.select({ id: entryMedia.mediaId }).from(entryMedia).where(eq(entryMedia.mediaId, id)).limit(1);
    const [avatarRef] = await db.select({ id: profile.avatarId }).from(profile).where(eq(profile.avatarId, id)).limit(1);
    if (entryRef || avatarRef) return error("Media is in use", 409);
    if (!store) return error("Media storage unavailable", 500);
    await store.delete(row.objectKey);
    await db.delete(media).where(and(eq(media.id, id), eq(media.objectKey, row.objectKey)));
    return json({ ok: true });
  } catch { return error("Unable to delete media", 500); }
}
