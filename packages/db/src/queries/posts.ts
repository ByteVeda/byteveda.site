import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { type PostSeo, type PostSite, posts } from "../schema/posts";

/**
 * The public face of a post.
 *
 * The public sites see this and nothing else — no status, no revisions, no
 * editor state. They cannot reach a draft because these queries never select
 * one, rather than because they remember to filter.
 */
export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  /** ISO `YYYY-MM-DD`, in UTC. */
  date: string;
  tags: string[];
  author: string;
  seo: PostSeo;
};

export type BlogPost = BlogPostMeta & { content: string };

function isoDate(value: Date | null): string {
  return (value ?? new Date(0)).toISOString().slice(0, 10);
}

const PUBLIC_COLUMNS = {
  slug: posts.slug,
  title: posts.title,
  description: posts.description,
  publishedAt: posts.publishedAt,
  tags: posts.tags,
  author: posts.author,
  seo: posts.seo,
} as const;

function toMeta(row: {
  slug: string;
  title: string;
  description: string;
  publishedAt: Date | null;
  tags: string[];
  author: string;
  seo: PostSeo;
}): BlogPostMeta {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: isoDate(row.publishedAt),
    tags: row.tags,
    author: row.author,
    seo: row.seo,
  };
}

/** Every published post for a site, newest first. */
export async function getPublishedPosts(site: PostSite = "flexiq"): Promise<BlogPostMeta[]> {
  const rows = await getDb()
    .select(PUBLIC_COLUMNS)
    .from(posts)
    .where(and(eq(posts.site, site), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt));

  return rows.map(toMeta);
}

export async function getPublishedPost(
  slug: string,
  site: PostSite = "flexiq",
): Promise<BlogPost | null> {
  const [row] = await getDb()
    .select({ ...PUBLIC_COLUMNS, content: posts.bodyMdx })
    .from(posts)
    .where(and(eq(posts.site, site), eq(posts.slug, slug), eq(posts.status, "published")))
    .limit(1);

  return row ? { ...toMeta(row), content: row.content } : null;
}

/** Slugs only — what `generateStaticParams` needs, without loading any bodies. */
export async function getPublishedSlugs(site: PostSite = "flexiq"): Promise<string[]> {
  const rows = await getDb()
    .select({ slug: posts.slug })
    .from(posts)
    .where(and(eq(posts.site, site), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt));

  return rows.map((row) => row.slug);
}
