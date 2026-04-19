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
