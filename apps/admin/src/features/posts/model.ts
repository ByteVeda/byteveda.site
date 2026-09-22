/**
 * What a post is before anything has been read out of the database.
 *
 * The shapes the list and the history panel are described in, the slug rules
 * Postgres also enforces, and the conversion between the two editors. All of it
 * runs in the browser as well as on the server — the editor validates a slug on
 * every keystroke and serialises rich text on a timer, and neither can wait for
 * a round trip. So there is no value import of `@byteveda/db` here and no I/O;
 * the rows themselves are `queries.ts`.
 */

import type { Post } from "@byteveda/db";
import { marked } from "marked";
import TurndownService from "turndown";

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

/**
 * Slugs are constrained in Postgres too (`posts_slug_check`). This produces a
 * value that satisfies that constraint, so a bad title becomes a usable slug
 * rather than a failed insert.
 */
const MAX_LENGTH = 60;

export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      // Strip the accents NFKD just separated out.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // An apostrophe joins words rather than splitting them: "don't" → "dont".
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_LENGTH)
      .replace(/-+$/, "")
  );
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/** Appends `-2`, `-3`, … until the slug is free. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, MAX_LENGTH - tail.length).replace(/-+$/, "")}${tail}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * The bridge between the two editors.
 *
 * `body_mdx` is what the public site renders, so rich text has to come back out
 * as Markdown on every save. The conversion runs in the browser, where the
 * editor already holds the document — no server round trip.
 */
function turndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Turndown has no strikethrough rule of its own, and StarterKit can produce it.
  service.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: (content) => `~~${content}~~`,
  });

  // Keep the language on a fenced block: Tiptap writes it as `language-*`.
  service.addRule("fencedCodeWithLanguage", {
    filter: (node) => node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = (node as HTMLElement).firstChild as HTMLElement;
      const language = /language-(\S+)/.exec(code.className ?? "")?.[1] ?? "";
      return `\n\n\`\`\`${language}\n${code.textContent ?? ""}\n\`\`\`\n\n`;
    },
  });

  return service;
}

export function htmlToMarkdown(html: string): string {
  return turndown().turndown(html).trim();
}

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { gfm: true, breaks: false, async: false });
}

/**
 * Whether the source uses anything Markdown alone cannot express.
 *
 * A capitalised tag is an MDX component, and `import`/`export` are MDX module
 * syntax. Converting either into rich text would silently drop it, so the
 * editor refuses the switch instead.
 */
export function containsJsx(source: string): boolean {
  const withoutCode = source.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return (
    /<[A-Z][A-Za-z0-9]*[\s/>]/.test(withoutCode) ||
    /^\s*(import|export)\s+/m.test(withoutCode) ||
    // A brace expression at the start of a line is an MDX value, not prose.
    /^\s*\{[^}]*\}\s*$/m.test(withoutCode)
  );
}
