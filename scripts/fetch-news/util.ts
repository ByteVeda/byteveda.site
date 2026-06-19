import { createHash } from "node:crypto";
import { config } from "./config";

export function stableId(source: string, key: string): string {
  return `${source}:${createHash("sha1").update(key).digest("hex").slice(0, 12)}`;
}

export function stripHtml(input: string): string {
  return input
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  // Slice by code points so emoji surrogate pairs are never split, which would
  // leave a lone surrogate that strict JSON parsers (Turbopack) reject.
  const chars = Array.from(input);
  if (chars.length <= max) return input;
  return `${chars
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`;
}

// Matches a high surrogate not followed by a low surrogate, or a low surrogate
// not preceded by a high one — i.e. broken UTF-16 that strict JSON parsers reject.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Removes unpaired surrogate code units so the serialized JSON stays valid. */
export function stripLoneSurrogates(input: string): string {
  return input.replace(LONE_SURROGATE, "");
}

export function containsMention(haystack: string): boolean {
  const lower = haystack.toLowerCase();
  return config.mentionTerms.some((term) => lower.includes(term));
}
