import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { adminUsers } from "./auth";

/**
 * Which public site a post belongs to. Only FlexiQ has a blog today; the column
 * exists so adding one is a row-level concern rather than a schema change.
 */
export const POST_SITES = ["flexiq"] as const;
export type PostSite = (typeof POST_SITES)[number];

export const POST_STATUSES = ["draft", "published", "archived"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/**
 * How the body was written. `body_mdx` is authoritative either way — this only
 * says which editor round-trips it without losing anything.
 */
export const POST_FORMATS = ["richtext", "mdx"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export type PostSeo = {
  keywords: string[];
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
};

export const EMPTY_SEO: PostSeo = { keywords: [] };

/** Column values are constrained in the database as well as in the types, because
 *  the types stop being enforced the moment anything else connects. */
function oneOf(column: string, values: readonly string[]) {
  return sql.raw(`"${column}" in (${values.map((value) => `'${value}'`).join(", ")})`);
}

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    site: text("site").$type<PostSite>().notNull().default("flexiq"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** What the public site renders, whichever editor produced it. */
    bodyMdx: text("body_mdx").notNull().default(""),
    bodyFormat: text("body_format").$type<PostFormat>().notNull().default("richtext"),
    /** Tiptap's document, kept so rich-text editing is lossless across sessions. */
    editorJson: jsonb("editor_json").$type<unknown>(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    status: text("status").$type<PostStatus>().notNull().default("draft"),
    seo: jsonb("seo").$type<PostSeo>().notNull().default(EMPTY_SEO),
    author: text("author").notNull().default("ByteVeda"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("posts_site_slug_idx").on(table.site, table.slug),
    // The public index page's exact query: one site's published posts, newest first.
    index("posts_site_status_published_idx").on(table.site, table.status, table.publishedAt),
    check("posts_site_check", oneOf("site", POST_SITES)),
    check("posts_status_check", oneOf("status", POST_STATUSES)),
    check("posts_body_format_check", oneOf("body_format", POST_FORMATS)),
    // A slug is a URL path segment on a public site, so the shape is enforced
    // here rather than trusted from whatever wrote the row.
    check("posts_slug_check", sql`"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    // Published means "has a date"; the pair should never disagree.
    check("posts_published_at_check", sql`("status" = 'published') = ("published_at" is not null)`),
  ],
);

/**
 * A snapshot per save.
 *
 * Postgres is the source of truth for posts, which means they have no git
 * history. This table is what buys the rollback back, and it is the only reason
 * it exists.
 */
export const postRevisions = pgTable(
  "post_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    bodyMdx: text("body_mdx").notNull().default(""),
    bodyFormat: text("body_format").$type<PostFormat>().notNull().default("richtext"),
    editorJson: jsonb("editor_json").$type<unknown>(),
    // The revision outlives the account that wrote it.
    authorId: uuid("author_id").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("post_revisions_post_id_created_idx").on(table.postId, table.createdAt)],
);

export const postsRelations = relations(posts, ({ many }) => ({
  revisions: many(postRevisions),
}));

export const postRevisionsRelations = relations(postRevisions, ({ one }) => ({
  post: one(posts, { fields: [postRevisions.postId], references: [posts.id] }),
  author: one(adminUsers, { fields: [postRevisions.authorId], references: [adminUsers.id] }),
}));

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostRevision = typeof postRevisions.$inferSelect;
