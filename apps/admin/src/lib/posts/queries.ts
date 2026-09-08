import { adminUsers, getDb, type Post, type PostSite, postRevisions, posts } from "@byteveda/db";
import { and, desc, eq, ne } from "drizzle-orm";

export type PostListItem = {
  id: string;
  slug: string;
  title: string;
  status: Post["status"];
  tags: string[];
  updatedAt: Date;
  publishedAt: Date | null;
};

export type RevisionListItem = {
  id: string;
  title: string;
  createdAt: Date;
  authorLogin: string | null;
};

export async function listPosts(site: PostSite = "flexiq"): Promise<PostListItem[]> {
  return getDb()
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      tags: posts.tags,
      updatedAt: posts.updatedAt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(eq(posts.site, site))
    .orderBy(desc(posts.updatedAt));
}

export async function getPostById(id: string): Promise<Post | null> {
  const [row] = await getDb().select().from(posts).where(eq(posts.id, id)).limit(1);
  return row ?? null;
}

/**
 * The other posts' bodies, which is what makes the keyword ranking relative:
 * a term every post uses says nothing about any one of them.
 */
export async function getCorpus(excludeId: string, site: PostSite = "flexiq"): Promise<string[]> {
  const rows = await getDb()
    .select({ body: posts.bodyMdx })
    .from(posts)
    .where(and(eq(posts.site, site), ne(posts.id, excludeId)));

  return rows.map((row) => row.body).filter(Boolean);
}

/** Slugs already in use on a site, so a new one can avoid them before insert. */
export async function getTakenSlugs(site: PostSite = "flexiq", excludeId?: string) {
  const rows = await getDb()
    .select({ slug: posts.slug })
    .from(posts)
    .where(excludeId ? and(eq(posts.site, site), ne(posts.id, excludeId)) : eq(posts.site, site));

  return rows.map((row) => row.slug);
}

export async function listRevisions(postId: string, limit = 25): Promise<RevisionListItem[]> {
  return getDb()
    .select({
      id: postRevisions.id,
      title: postRevisions.title,
      createdAt: postRevisions.createdAt,
      authorLogin: adminUsers.login,
    })
    .from(postRevisions)
    .leftJoin(adminUsers, eq(postRevisions.authorId, adminUsers.id))
    .where(eq(postRevisions.postId, postId))
    .orderBy(desc(postRevisions.createdAt))
    .limit(limit);
}

export async function getRevision(id: string) {
  const [row] = await getDb().select().from(postRevisions).where(eq(postRevisions.id, id)).limit(1);
  return row ?? null;
}

export async function countPostsByStatus(site: PostSite = "flexiq") {
  const rows = await getDb()
    .select({ status: posts.status })
    .from(posts)
    .where(eq(posts.site, site));

  return rows.reduce<Record<string, number>>((totals, row) => {
    totals[row.status] = (totals[row.status] ?? 0) + 1;
    return totals;
  }, {});
}
