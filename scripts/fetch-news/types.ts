import type { NewsItem, NewsSource } from "@/features/news";

export type SourceAdapter = {
  name: string;
  source: NewsSource;
  fetch: () => Promise<NewsItem[]>;
};

export type { NewsItem, NewsSource };
