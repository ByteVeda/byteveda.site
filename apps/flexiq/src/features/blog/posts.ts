import { isConfigured } from "@byteveda/db";
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

/**
 * No `DATABASE_URL` at all means a build without secrets — CI, or a preview —
 * and a deploy should not fail for it. The pages render empty and fill in on
 * the first request once the variable is present.
 *
 * A database that is configured but unreachable is a different thing entirely,
 * and is left to throw: that is an incident, and silently serving an empty blog
 * for an hour of cache would hide it.
 */
function withoutDatabase<T>(empty: T): T | null {
  if (isConfigured()) return null;
  console.warn("[blog] DATABASE_URL is not set; rendering an empty blog");
  return empty;
}

export const getPosts = unstable_cache(
  async () => withoutDatabase<BlogPostMeta[]>([]) ?? (await getPublishedPosts(SITE)),
  ["flexiq", "posts"],
  { tags: ["blog"], revalidate: REVALIDATE_SECONDS },
);

export function getPost(slug: string): Promise<Post | null> {
  return unstable_cache(
    async () => (isConfigured() ? await getPublishedPost(slug, SITE) : null),
    ["flexiq", "post", slug],
    { tags: ["blog", `blog:${slug}`], revalidate: REVALIDATE_SECONDS },
  )();
}

/**
 * Slugs to prerender at build time.
 *
 * Unreachable database means an empty list, not a failed build: every page is
 * still served on demand, and a deploy should not depend on the database being
 * up at the moment it runs.
 */
export async function getStaticSlugs(): Promise<string[]> {
  if (!isConfigured()) return [];

  try {
    return await getPublishedSlugs(SITE);
  } catch (error) {
    // Unlike the readers above this one swallows a live failure too: a build
    // should not stop because the database blinked while enumerating slugs.
    // Every page still renders on demand.
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
