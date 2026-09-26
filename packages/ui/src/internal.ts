/**
 * Helpers the components share and nothing outside this package sees. They
 * live here rather than in `@byteveda/utils` so the published package has no
 * dependency on the monorepo's private one. Not re-exported from the index.
 */

type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

export function isExternalUrl(href: string): boolean {
  return /^(?:https?:)?\/\//.test(href);
}
