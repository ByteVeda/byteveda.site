import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const BLOG_DIR = join(process.cwd(), "content/blog");

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  tags: string[];
  author: string;
}

export interface Post extends PostMeta {
  content: string;
}

/**
 * A slug becomes a URL path segment and a static route, so it is restricted to
 * an unambiguous alphabet rather than trusted because it came off the disk.
 * Anything else is a filename that should not have been added.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parse(filename: string): Post {
  const slug = filename.replace(/\.mdx$/, "");
  if (!SLUG.test(slug)) {
    throw new Error(`content/blog/${filename}: slug "${slug}" must be lowercase kebab-case`);
  }

  const raw = readFileSync(join(BLOG_DIR, filename), "utf8");
  const { data, content } = matter(raw);

  // A post missing its frontmatter is an authoring mistake, and one that would
  // otherwise ship as an untitled entry in the index and the feed.
  for (const field of ["title", "description", "date"] as const) {
    if (!data[field]) throw new Error(`content/blog/${filename} is missing "${field}"`);
  }

  return {
    slug,
    title: String(data.title),
    description: String(data.description),
    date: String(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    author: String(data.author ?? "ByteVeda"),
    content,
  };
}

/** Every post, newest first. */
export function getPosts(): Post[] {
  return readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map(parse)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((post) => post.slug === slug);
}

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
