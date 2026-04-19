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
