import { env } from "cloudflare:workers";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { entries, entryMedia, media, profile } from "@/db/schema";
import { error } from "@/lib/server/http";

const cacheHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", Vary: "Cookie" };
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb(), id = (await context.params).id;
    const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row || !env.BUCKET) return error("Not found", 404, cacheHeaders);
    const [publicLink] = await db.select({ id: entryMedia.mediaId }).from(entryMedia)
      .innerJoin(entries, eq(entries.id, entryMedia.entryId))
      .where(and(eq(entryMedia.mediaId, id), ne(entries.category, "life"), eq(entries.status, "published"), eq(entries.visibility, "public"))).limit(1);
    const [avatar] = await db.select({ id: profile.avatarId }).from(profile).where(eq(profile.avatarId, id)).limit(1);
    if (!publicLink && !avatar) return error("Not found", 404, cacheHeaders);
    const object = await env.BUCKET.get(row.objectKey);
    if (!object) return error("Not found", 404, cacheHeaders);
    return new Response(object.body, { headers: { ...cacheHeaders, "Content-Type": row.mimeType, "Content-Length": String(row.size) } });
  } catch { return error("Unable to load media", 500, cacheHeaders); }
}
export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
