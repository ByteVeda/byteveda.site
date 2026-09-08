import {
  type BlogPost,
  type BlogPostMeta,
  getPublishedPost,
  getPublishedPosts,
  getPublishedSlugs,
} from "@byteveda/db/queries/posts";
import { unstable_cache } from "next/cache";

/**
 * Posts come from Postgres, written by the admin console.
 *
 * Reads are cached and tagged, so the site stays effectively static between
 * publishes: `revalidateTag("blog")` from the admin app is what makes a change
 * visible, rather than a rebuild.
 */
export type PostMeta = BlogPostMeta;
export type Post = BlogPost;

const SITE = "flexiq" as const;
/** A ceiling, not the mechanism. Publishing invalidates by tag immediately. */
const REVALIDATE_SECONDS = 3600;

export const getPosts = unstable_cache(() => getPublishedPosts(SITE), ["flexiq", "posts"], {
  tags: ["blog"],
  revalidate: REVALIDATE_SECONDS,
});

export function getPost(slug: string): Promise<Post | null> {
  return unstable_cache(() => getPublishedPost(slug, SITE), ["flexiq", "post", slug], {
    tags: ["blog", `blog:${slug}`],
    revalidate: REVALIDATE_SECONDS,
  })();
}

/**
 * Slugs to prerender at build time.
 *
 * Unreachable database means an empty list, not a failed build: every page is
 * still served on demand, and a deploy should not depend on the database being
 * up at the moment it runs.
 */
export async function getStaticSlugs(): Promise<string[]> {
  try {
    return await getPublishedSlugs(SITE);
  } catch (error) {
    console.warn("[blog] could not read slugs at build time; rendering on demand", error);
    return [];
  }
}

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
