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
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

export function containsMention(haystack: string): boolean {
  const lower = haystack.toLowerCase();
  return config.mentionTerms.some((term) => lower.includes(term));
}
