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
