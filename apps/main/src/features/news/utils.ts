import rawNews from "./data/news.json";
import type { FeedKind, Label, NewsItem, NewsSource } from "./types";
import { LABELS } from "./types";

const SOURCE_LABEL: Record<NewsSource, string> = {
  devto: "dev.to",
  hn: "Hacker News",
  github: "GitHub",
  reddit: "Reddit",
  lobsters: "Lobsters",
  hashnode: "Hashnode",
  mastodon: "Mastodon",
  rss: "Blog",
};

export function sourceLabel(source: NewsSource): string {
  return SOURCE_LABEL[source];
}

export function isLabel(value: string): value is Label {
  return (LABELS as readonly string[]).includes(value);
}

function itemsOfKind(kind: FeedKind): NewsItem[] {
  return (rawNews as NewsItem[]).filter((item) => item.kind === kind);
}

function slice(items: NewsItem[], limit?: number): NewsItem[] {
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export function getArticles(limit?: number): NewsItem[] {
  return slice(itemsOfKind("article"), limit);
}

export function getReleases(limit?: number): NewsItem[] {
  return slice(itemsOfKind("release"), limit);
}

export function getTrending(limit?: number): NewsItem[] {
  return slice(itemsOfKind("trending"), limit);
}

/** Releases + articles, newest first (ISO timestamps sort lexically). */
export function getNewsItems(limit?: number): NewsItem[] {
  const merged = [...itemsOfKind("release"), ...itemsOfKind("article")].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
  return slice(merged, limit);
}

export const NEWS_CATEGORIES = ["release", "engineering", "community", "announcement"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

/** Singular label shown on a card's tag. */
export const CATEGORY_TAG: Record<NewsCategory, string> = {
  release: "Release",
  engineering: "Engineering",
  community: "Community",
  announcement: "Announcement",
};

/** Label shown on the toolbar filter (plus "All"). */
export const CATEGORY_FILTER: Record<NewsCategory | "all", string> = {
  all: "All",
  release: "Releases",
  engineering: "Engineering",
  community: "Community",
  announcement: "Announcements",
};

const ENGINEERING_SOURCES: ReadonlySet<NewsSource> = new Set<NewsSource>([
  "rss",
  "devto",
  "hashnode",
]);

/** Derive a newsroom category from a live feed item. */
export function newsCategory(item: NewsItem): NewsCategory {
  if (item.kind === "release") return "release";
  if (ENGINEERING_SOURCES.has(item.source)) return "engineering";
  return "community";
}
