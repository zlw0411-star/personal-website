import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import { DEFAULT_PROFILE, type Category, type Entry, type EntryInput, type EntrySummary, type Profile, type RichDoc, type RichNode } from "@/lib/content-types";
import { entries, entryMedia, media, profile } from "@/db/schema";

function decode(row: typeof entries.$inferSelect): Entry {
  return { ...row, category: (row.category === "project" ? "learning" : row.category) as Category, status: row.status as Entry["status"], visibility: row.visibility as Entry["visibility"], body: JSON.parse(row.body) as RichDoc };
}
export async function getProfile(): Promise<Profile> {
  const [row] = await getDb().select().from(profile).where(eq(profile.id, 1)).limit(1);
  if (!row) return DEFAULT_PROFILE;
  return { siteName: row.siteName, nickname: row.nickname, bio: row.bio, about: row.about, experience: row.experience, avatarId: row.avatarId, email: row.email, links: JSON.parse(row.links), contacts: JSON.parse(row.contacts || "[]") };
}
export async function listPublicEntries(category?: Category, limit?: number, allowLife = false): Promise<Entry[]> {
  const db = getDb();
  if (category === "life" && !allowLife) return [];
  const publicOther = and(ne(entries.category, "life"), eq(entries.status, "published"), eq(entries.visibility, "public"));
  const publishedLife = and(eq(entries.category, "life"), eq(entries.status, "published"));
  const categoryFilter = category === "life" ? publishedLife
    : category === "learning" ? and(inArray(entries.category, ["learning", "project"]), eq(entries.status, "published"), eq(entries.visibility, "public"))
    : category ? and(eq(entries.category, category), eq(entries.status, "published"), eq(entries.visibility, "public"))
    : allowLife ? or(publicOther, publishedLife) : publicOther;
  const query = db.select().from(entries).where(categoryFilter).orderBy(desc(entries.publishedAt), desc(entries.createdAt));
  const rows = limit === undefined ? await query : await query.limit(Math.min(100, Math.max(1, limit)));
  return rows.map(decode);
}
export async function getPublicEntry(id: string, allowLife = false): Promise<Entry | null> {
  const publicOther = and(ne(entries.category, "life"), eq(entries.status, "published"), eq(entries.visibility, "public"));
  const publishedLife = and(eq(entries.category, "life"), eq(entries.status, "published"));
  const [row] = await getDb().select().from(entries).where(and(eq(entries.id, id), allowLife ? or(publicOther, publishedLife) : publicOther)).limit(1);
  return row ? decode(row) : null;
}
export async function getEntryAccessKind(id: string): Promise<"life" | "other" | null> {
  const [row] = await getDb().select({ category: entries.category, status: entries.status, visibility: entries.visibility }).from(entries).where(eq(entries.id, id)).limit(1);
  if (!row || row.status !== "published") return null;
  if (row.category === "life") return "life";
  if (row.visibility !== "public") return null;
  return "other";
}
export async function listAdminEntries(): Promise<EntrySummary[]> {
  const rows = await getDb().select({
    id: entries.id, category: entries.category, title: entries.title, summary: entries.summary,
    coverId: entries.coverId, status: entries.status, visibility: entries.visibility,
    projectUrl: entries.projectUrl, repositoryUrl: entries.repositoryUrl,
    createdAt: entries.createdAt, updatedAt: entries.updatedAt, publishedAt: entries.publishedAt,
  }).from(entries).orderBy(desc(entries.updatedAt));
  return rows.map((row) => ({
    ...row,
    category: (row.category === "project" ? "learning" : row.category) as Category,
    status: row.status as Entry["status"],
    visibility: row.visibility as Entry["visibility"],
  }));
}
export async function getAdminEntry(id: string): Promise<Entry | null> {
  const [row] = await getDb().select().from(entries).where(eq(entries.id, id)).limit(1);
  return row ? decode(row) : null;
}
export async function getAdminEntriesByIds(ids: string[]): Promise<Entry[]> {
  const rows = await getDb().select().from(entries).where(inArray(entries.id, ids));
  const byId = new Map(rows.map((row) => [row.id, decode(row)]));
  return ids.flatMap((id) => { const entry = byId.get(id); return entry ? [entry] : []; });
}
export async function saveEntry(id: string | null, input: EntryInput): Promise<Entry> {
  input = { ...input, category: input.category === "project" ? "learning" : input.category, visibility: input.category === "life" ? "private" : input.visibility };
  const db = getDb(); const now = new Date().toISOString();
  const existing = id ? await getAdminEntry(id) : null;
  if (id && !existing) throw new Error("Entry not found");
  const mediaIds = collectMediaIds(input.body);
  if (input.coverId) mediaIds.add(input.coverId);
  if (mediaIds.size) {
    const found = await db.select({ id: media.id }).from(media).where(inArray(media.id, [...mediaIds]));
    if (found.length !== mediaIds.size) throw new Error("Entry references missing media");
  }
  const entryId = id ?? crypto.randomUUID();
  const publishedAt = input.status === "published" ? existing?.publishedAt ?? now : existing?.publishedAt ?? null;
  const row = { id: entryId, ...input, body: JSON.stringify(input.body), createdAt: existing?.createdAt ?? now, updatedAt: now, publishedAt };
  const upsert = db.insert(entries).values(row).onConflictDoUpdate({ target: entries.id, set: row });
  const clearLinks = db.delete(entryMedia).where(eq(entryMedia.entryId, entryId));
  if (mediaIds.size) {
    const addLinks = db.insert(entryMedia).values([...mediaIds].map(mediaId => ({ entryId, mediaId })));
    await db.batch([upsert, clearLinks, addLinks]);
  } else await db.batch([upsert, clearLinks]);
  return (await getAdminEntry(entryId))!;
}
export function collectMediaIds(doc: RichDoc, result = new Set<string>()): Set<string> {
  const visit = (node: RichNode) => {
    if (node.type === "image" && typeof node.attrs?.mediaId === "string") result.add(node.attrs.mediaId);
    const src = node.attrs?.src;
    if (node.type === "image" && typeof src === "string") { const match = src.match(/^\/api\/(?:admin\/)?media\/([0-9a-f-]{36})$/i); if (match) result.add(match[1]); }
    for (const child of node.content ?? []) visit(child);
  }; visit(doc); return result;
}
export async function deleteEntry(id: string) { await getDb().delete(entries).where(eq(entries.id, id)); }
export async function upsertProfile(value: Profile) {
  if (value.avatarId) {
    const [avatar] = await getDb().select({ id: media.id }).from(media).where(eq(media.id, value.avatarId)).limit(1);
    if (!avatar) throw new Error("Profile references missing media");
  }
  const stored = { ...value, links: JSON.stringify(value.links), contacts: JSON.stringify(value.contacts) };
  await getDb().insert(profile).values({ id: 1, ...stored }).onConflictDoUpdate({ target: profile.id, set: stored });
  return value;
}
export { entries, entryMedia, media, profile };
