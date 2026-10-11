import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("entries", {
  id: text("id").primaryKey(), category: text("category").notNull(), title: text("title").notNull(),
  summary: text("summary").notNull(), body: text("body").notNull(), coverId: text("cover_id"),
  status: text("status").notNull(), visibility: text("visibility").notNull(), projectUrl: text("project_url").notNull().default(""),
  repositoryUrl: text("repository_url").notNull().default(""), createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(), publishedAt: text("published_at"),
});
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(), siteName: text("site_name").notNull(), nickname: text("nickname").notNull(),
  bio: text("bio").notNull(), about: text("about").notNull(), experience: text("experience").notNull(),
  avatarId: text("avatar_id"), email: text("email").notNull(), links: text("links").notNull(), contacts: text("contacts").notNull().default("[]"),
});
export const media = sqliteTable("media", {
  id: text("id").primaryKey(), objectKey: text("object_key").notNull().unique(), mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), createdAt: text("created_at").notNull(),
});
export const entryMedia = sqliteTable("entry_media", {
  entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  mediaId: text("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.entryId, t.mediaId] })]);
export const lifeSecurity = sqliteTable("life_security", {
  id: integer("id").primaryKey(), passwordHash: text("password_hash").notNull(), salt: text("salt").notNull(),
  algorithm: text("algorithm").notNull(), version: text("version").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0), lockedUntil: text("locked_until"),
});
export const lifeSessions = sqliteTable("life_sessions", {
  tokenHash: text("token_hash").primaryKey(), version: text("version").notNull(), expiresAt: text("expires_at").notNull(),
});
export const adminSecurity = sqliteTable("admin_security", {
  id: integer("id").primaryKey(), passwordHash: text("password_hash").notNull(), salt: text("salt").notNull(),
  algorithm: text("algorithm").notNull(), version: text("version").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0), lockedUntil: text("locked_until"),
});
export const adminSessions = sqliteTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(), version: text("version").notNull(), expiresAt: text("expires_at").notNull(),
});
