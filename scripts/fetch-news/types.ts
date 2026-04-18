import type { NewsItem, NewsSource } from "@/lib/news";

export type SourceAdapter = {
  name: string;
  source: NewsSource;
  fetch: () => Promise<NewsItem[]>;
};

export type { NewsItem, NewsSource };
