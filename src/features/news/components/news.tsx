import Link from "next/link";
import { NotebookSection, NotebookTicker, Star } from "@/components/ui";
import type { NewsItem } from "../types";
import { getArticles, getTrending } from "../utils";
import { NewsEntry } from "./news-entry";

type NewsProps = {
  articleLimit?: number;
  trendingLimit?: number;
};

function TrendingRepo({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-2 transition-colors hover:text-accent"
    >
      <span className="text-foreground">{item.title}</span>
      {item.score > 0 && (
        <span className="inline-flex items-baseline gap-1 text-muted-foreground tabular-nums">
          <Star className="h-3 w-3 translate-y-[1px]" strokeWidth={1.5} />
          {item.score.toLocaleString()}
        </span>
      )}
    </a>
  );
}

export function News({ articleLimit = 3, trendingLimit = 12 }: NewsProps) {
  const articles = getArticles(articleLimit);
  const trending = getTrending(trendingLimit);
  if (articles.length === 0 && trending.length === 0) return null;

  return (
    <NotebookSection
      id="news"
      index="04"
      eyebrow="community"
      title="From the community"
      subtitle="aggregated and refreshed every few hours"
      description="Articles and discussions from across the open-source ecosystem — dev.to, Hacker News, Reddit, Lobsters, Hashnode, Mastodon, and engineering blogs."
    >
      {articles.length > 0 && (
        <ol className="divide-y divide-border">
          {articles.map((item, i) => (
            <NewsEntry key={item.id} item={item} index={i + 1} />
          ))}
        </ol>
      )}

      {articles.length > 0 && (
        <div className="mt-10">
          <Link
            href="/news"
            className="notebook-serif inline-flex items-baseline gap-2 text-[15px] text-accent italic underline decoration-1 underline-offset-4 transition-colors hover:text-foreground"
          >
            see all news →
          </Link>
        </div>
      )}

      {trending.length > 0 && (
        <div className="mt-16">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="notebook-smallcaps text-[14px] text-foreground">Trending on GitHub</h3>
            <p className="notebook-mono text-[10px] text-muted-foreground tracking-[0.18em]">
              FIG.1 — the ticker
            </p>
          </div>
          <NotebookTicker
            items={trending}
            getKey={(item) => item.id}
            renderItem={(item) => <TrendingRepo item={item} />}
            ariaLabel="Trending repositories on GitHub"
          />
        </div>
      )}
    </NotebookSection>
  );
}
