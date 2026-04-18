import rawNews from "@/content/news.json";

export const NEWS_SOURCES = [
  "devto",
  "hn",
  "github",
  "reddit",
  "lobsters",
  "hashnode",
  "mastodon",
  "rss",
] as const;
export type NewsSource = (typeof NEWS_SOURCES)[number];

export const FEED_KINDS = ["article", "release", "trending"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export const LABELS = [
  "rust",
  "python",
  "java",
  "go",
  "typescript",
  "ai",
  "ml",
  "opensource",
  "performance",
  "devops",
  "security",
  "webdev",
] as const;
export type Label = (typeof LABELS)[number];

export type NewsItem = {
  id: string;
  kind: FeedKind;
  source: NewsSource;
  title: string;
  url: string;
  excerpt: string | null;
  author: string | null;
  publishedAt: string;
  score: number;
  tags: string[];
  labels: Label[];
  mentionsByteveda: boolean;
};

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
