import Link from "next/link";
import { getArticles, getTrending } from "@/lib/news";
import { NewsCard } from "./news-card";
import { ArrowRight } from "./ui/icons";
import { Marquee } from "./ui/marquee";
import { Section, SectionHeader } from "./ui/section";

type NewsProps = {
  articleLimit?: number;
  trendingLimit?: number;
  showViewAll?: boolean;
};

export function News({ articleLimit = 3, trendingLimit = 12, showViewAll = true }: NewsProps) {
  const articles = getArticles(articleLimit);
  const trending = getTrending(trendingLimit);
  if (articles.length === 0 && trending.length === 0) return null;

  return (
    <Section id="news">
      <SectionHeader
        align="split"
        eyebrow="News"
        title="From the community"
        description="Articles and discussions from dev.to, Hacker News, Reddit, Lobsters, Hashnode, Mastodon, and engineering blogs — plus what's trending across Rust, Python, and Java on GitHub."
      />

      {articles.length > 0 && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {showViewAll && articles.length > 0 && (
        <div className="mt-8">
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 font-mono text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            See all news
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
      )}

      {trending.length > 0 && (
        <div className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
                Trending
              </p>
              <h3 className="mt-1 font-medium text-foreground text-xl tracking-tight">
                Trending on GitHub
              </h3>
            </div>
          </div>
          <Marquee
            items={trending}
            getKey={(item) => item.id}
            itemClassName="w-[320px] h-[260px]"
            secondsPerItem={5}
            renderItem={(item) => <NewsCard item={item} className="h-full" />}
          />
        </div>
      )}
    </Section>
  );
}
