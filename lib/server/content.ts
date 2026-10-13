import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
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
export async function listPublicEntries(category?: Category, limit?: number): Promise<Entry[]> {
  const db = getDb();
  if (category === "life") return [];
  const publicOther = and(ne(entries.category, "life"), eq(entries.status, "published"), eq(entries.visibility, "public"));
  const categoryFilter = category === "learning" ? and(inArray(entries.category, ["learning", "project"]), eq(entries.status, "published"), eq(entries.visibility, "public"))
    : category ? and(eq(entries.category, category), eq(entries.status, "published"), eq(entries.visibility, "public"))
    : publicOther;
  const query = db.select().from(entries).where(categoryFilter).orderBy(desc(entries.publishedAt), desc(entries.createdAt));
  const rows = limit === undefined ? await query : await query.limit(Math.min(100, Math.max(1, limit)));
  return rows.map(decode);
}
export async function getPublicEntry(id: string): Promise<Entry | null> {
  const publicOther = and(ne(entries.category, "life"), eq(entries.status, "published"), eq(entries.visibility, "public"));
  const [row] = await getDb().select().from(entries).where(and(eq(entries.id, id), publicOther)).limit(1);
  return row ? decode(row) : null;
}
export async function listAdminEntries(): Promise<EntrySummary[]> {
  const rows = await getDb().select({
    id: entries.id, category: entries.category, title: entries.title, summary: entries.summary,
    coverId: entries.coverId, status: entries.status, visibility: entries.visibility,
    projectUrl: entries.projectUrl, repositoryUrl: entries.repositoryUrl,
    createdAt: entries.createdAt, updatedAt: entries.updatedAt, publishedAt: entries.publishedAt,
  }).from(entries).where(ne(entries.category, "life")).orderBy(desc(entries.updatedAt));
  return rows.map((row) => ({
    ...row,
    category: (row.category === "project" ? "learning" : row.category) as Category,
    status: row.status as Entry["status"],
    visibility: row.visibility as Entry["visibility"],
  }));
}
export async function getAdminEntry(id: string): Promise<Entry | null> {
  const [row] = await getDb().select().from(entries).where(and(eq(entries.id, id), ne(entries.category, "life"))).limit(1);
  return row ? decode(row) : null;
}
export async function getAdminEntriesByIds(ids: string[]): Promise<Entry[]> {
  const rows = ids.length ? await getDb().select().from(entries).where(and(inArray(entries.id, ids), ne(entries.category, "life"))) : [];
  const byId = new Map(rows.map((row) => [row.id, decode(row)]));
  return ids.flatMap((id) => { const entry = byId.get(id); return entry ? [entry] : []; });
}
export async function saveEntry(id: string | null, input: EntryInput): Promise<Entry> {
  if (input.category === "life") throw new Error("Life category is disabled");
  input = { ...input, category: input.category === "project" ? "learning" : input.category };
  const db = getDb(); const now = new Date().toISOString();
  const existing = id ? await getAdminEntry(id) : null;
  if (id && !existing) throw new Error("Entry not found");
  const mediaIds = collectMediaIds(input.body);
  if (input.coverId) mediaIds.add(input.coverId);
  if (mediaIds.size) {
    const found = await db.select({ id: media.id }).from(media).where(inArray(media.id, [...mediaIds]));
    if (found.length !== mediaIds.size) throw Object.assign(new Error("Entry references missing media"), { code: "ENTRY_INVALID_MEDIA" });
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
export async function createEntry(createId: string, input: EntryInput): Promise<{ entry: Entry; created: boolean }> {
  if (input.category === "life") throw new Error("Life category is disabled");
  input = { ...input, category: input.category === "project" ? "learning" : input.category };
  const db = getDb(); const now = new Date().toISOString();
  const mediaIds = collectMediaIds(input.body);
  if (input.coverId) mediaIds.add(input.coverId);
  if (mediaIds.size) {
    const found = await db.select({ id: media.id }).from(media).where(inArray(media.id, [...mediaIds]));
    if (found.length !== mediaIds.size) throw Object.assign(new Error("Entry references missing media"), { code: "ENTRY_INVALID_MEDIA" });
  }
  const row = { id: createId, ...input, body: JSON.stringify(input.body), createdAt: now, updatedAt: now,
    publishedAt: input.status === "published" ? now : null };
  const insert = db.insert(entries).values(row).onConflictDoNothing({ target: entries.id }).returning({ id: entries.id });
  // D1 runs a batch transactionally. `changes()` gates every link insert on the
  // preceding entry insert, so a replay can never attach media to an ID collision.
  const statements = [insert, ...[...mediaIds].map(mediaId => db.insert(entryMedia).select(
    db.select({ entryId: entries.id, mediaId: sql`${mediaId}`.as("media_id") }).from(entries)
      .where(and(eq(entries.id, createId), sql`changes() > 0`))
  ))] as const;
  const results = await db.batch(statements);
  const entry = await getAdminEntry(createId);
  if (!entry) throw new Error("Unable to create entry");
  if (!sameEntryInput(entry, input)) throw Object.assign(new Error("Entry create ID already belongs to different content"), { code: "ENTRY_CREATE_CONFLICT" });
  return { entry, created: results[0].length > 0 };
}

function sameEntryInput(entry: Entry, input: EntryInput): boolean {
  return entry.category === input.category && entry.title === input.title && entry.summary === input.summary
    && entry.status === input.status && entry.visibility === input.visibility && entry.coverId === input.coverId
    && entry.projectUrl === input.projectUrl && entry.repositoryUrl === input.repositoryUrl
    && JSON.stringify(entry.body) === JSON.stringify(input.body);
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
