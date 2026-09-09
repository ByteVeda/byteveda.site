/**
 * One-time import of the FlexiQ blog's MDX files into Postgres.
 *
 * Postgres became the source of truth for posts, and this is what carries the
 * files that were there first across. Idempotent: re-running updates the same
 * rows rather than duplicating them, so it is safe against a half-finished run.
 *
 *   pnpm --filter @byteveda/db import:posts ../../apps/flexiq/content/blog
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import matter from "gray-matter";
import { closeDb, getDb } from "../src/client";
import { type PostSite, posts } from "../src/schema/posts";

const SITE: PostSite = "flexiq";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Parsed = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  author: string;
  body: string;
};

function parse(directory: string, filename: string): Parsed {
  const slug = filename.replace(/\.mdx$/, "");
  if (!SLUG.test(slug)) {
    throw new Error(`${filename}: slug "${slug}" must be lowercase kebab-case`);
  }

  const { data, content } = matter(readFileSync(join(directory, filename), "utf8"));

  for (const field of ["title", "description", "date"] as const) {
    if (!data[field]) throw new Error(`${filename} is missing "${field}"`);
  }

  return {
    slug,
    title: String(data.title),
    description: String(data.description),
    date: String(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    author: String(data.author ?? "ByteVeda"),
    body: content.trim(),
  };
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: import:posts <path to content/blog>");
    process.exit(1);
  }

  const directory = resolve(process.cwd(), target);
  const files = readdirSync(directory).filter((file) => file.endsWith(".mdx"));

  if (files.length === 0) {
    console.log(`Nothing to import from ${directory}.`);
    return;
  }

  const db = getDb();

  for (const file of files) {
    const post = parse(directory, file);

    await db
      .insert(posts)
      .values({
        site: SITE,
        slug: post.slug,
        title: post.title,
        description: post.description,
        bodyMdx: post.body,
        // These were written as MDX by hand; rich text would not round-trip them.
        bodyFormat: "mdx",
        editorJson: null,
        tags: post.tags,
        author: post.author,
        status: "published",
        publishedAt: new Date(`${post.date}T00:00:00Z`),
        seo: { keywords: [] },
      })
      .onConflictDoUpdate({
        target: [posts.site, posts.slug],
        set: {
          title: post.title,
          description: post.description,
          bodyMdx: post.body,
          bodyFormat: "mdx",
          tags: post.tags,
          author: post.author,
          status: "published",
          publishedAt: new Date(`${post.date}T00:00:00Z`),
          updatedAt: new Date(),
        },
      });

    console.log(`  ${basename(file)} → ${SITE}/${post.slug}`);
  }

  console.log(`Imported ${files.length} post${files.length === 1 ? "" : "s"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
