/**
 * Turning MDX into something countable.
 *
 * Everything here is deliberately lexical. Parsing the MDX properly would mean
 * carrying a full pipeline into the editor's keystroke path for an answer that
 * only has to be approximately right.
 */

/** Fenced code, inline code, JSX, and comments are not prose and must not be counted. */
export function stripMarkup(source: string): string {
  return (
    source
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/~~~[\s\S]*?~~~/g, " ")
      .replace(/`[^`\n]*`/g, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // JSX and HTML elements, keeping whatever sat between the tags.
      .replace(/<\/?[A-Za-z][^>]*>/g, " ")
      // Images before links, so alt text does not survive as link text.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s{0,3}([*+-]|\d+\.)\s+/gm, "")
      .replace(/[*_~]{1,3}/g, "")
      .replace(/^\s*\|.*\|\s*$/gm, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export type Heading = { level: number; text: string };

export function headings(source: string): Heading[] {
  const found: Heading[] = [];
  const withoutCode = source.replace(/```[\s\S]*?```/g, "");

  for (const match of withoutCode.matchAll(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/gm)) {
    found.push({ level: match[1].length, text: stripMarkup(match[2]) });
  }
  return found;
}

/** Every link target in the body, in source order. */
export function links(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) {
    found.push(match[1]);
  }
  return found;
}

export function isInternalLink(href: string): boolean {
  if (href.startsWith("#")) return false;
  if (href.startsWith("/")) return true;

  // The trailing `(\/|\?|#|$)` is load-bearing. Without it the pattern matches
  // any host that merely starts with ours — `byteveda.org.example.com` would
  // count as an internal link.
  return /^https?:\/\/([a-z0-9-]+\.)*byteveda\.org(\/|\?|#|$)/i.test(href);
}

/** The first real paragraph — what a search engine shows and a reader reads. */
export function firstParagraph(source: string): string {
  const body = source
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();

  for (const block of body.split(/\n\s*\n/)) {
    const text = stripMarkup(block);
    // Skip a leading heading, and anything that reduced to punctuation.
    if (text.length > 40) return text;
  }
  return "";
}

export function wordCount(source: string): number {
  const text = stripMarkup(source);
  return text ? text.split(/\s+/).length : 0;
}
