import type { FeedKind } from "@/lib/news";
import { config } from "./config";
import type { NewsItem } from "./types";

function dedupe(items: NewsItem[]): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || item.score > existing.score) byId.set(item.id, item);
  }
  const byUrl = new Map<string, NewsItem>();
  for (const item of byId.values()) {
    const key = `${item.kind}|${normalizeUrl(item.url)}`;
    const existing = byUrl.get(key);
    if (!existing || preferWinner(item, existing)) byUrl.set(key, item);
  }
  return [...byUrl.values()];
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "ref_src") {
        u.searchParams.delete(key);
      }
    }
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url;
  }
}

function preferWinner(a: NewsItem, b: NewsItem): boolean {
  if (a.mentionsByteveda !== b.mentionsByteveda) return a.mentionsByteveda;
  return a.score > b.score;
}

const byPublishedDesc = (a: NewsItem, b: NewsItem): number =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

const byScoreDesc = (a: NewsItem, b: NewsItem): number => b.score - a.score;

const sorters: Record<FeedKind, (a: NewsItem, b: NewsItem) => number> = {
  article: byPublishedDesc,
  release: byPublishedDesc,
  trending: byScoreDesc,
};

const KIND_ORDER: FeedKind[] = ["release", "article", "trending"];

function groupByKind(items: NewsItem[]): Map<FeedKind, NewsItem[]> {
  const map = new Map<FeedKind, NewsItem[]>();
  for (const kind of KIND_ORDER) map.set(kind, []);
  for (const item of items) {
    map.get(item.kind)?.push(item);
  }
  return map;
}

export function buildFeed(items: NewsItem[]): NewsItem[] {
  const deduped = dedupe(items);
  const grouped = groupByKind(deduped);
  const out: NewsItem[] = [];
  let remaining = config.output.maxItems;
  for (const kind of KIND_ORDER) {
    const bucket = grouped.get(kind) ?? [];
    bucket.sort(sorters[kind]);
    const capped = bucket.slice(0, config.output.maxItemsPerKind[kind]);
    const take = Math.min(capped.length, remaining);
    out.push(...capped.slice(0, take));
    remaining -= take;
    if (remaining <= 0) break;
  }
  return out;
}
