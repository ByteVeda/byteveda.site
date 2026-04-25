import Link from "next/link";
import { NotebookSection } from "@/components/ui";
import { getArticles } from "../utils";
import { NewsEntry } from "./news-entry";

type NewsProps = {
  articleLimit?: number;
};

export function News({ articleLimit = 3 }: NewsProps) {
  const articles = getArticles(articleLimit);
  if (articles.length === 0) return null;

  return (
    <NotebookSection
      id="news"
      index="04"
      eyebrow="community"
      title="From the community"
      subtitle="aggregated and refreshed every few hours"
      description="Articles and discussions from across the open-source ecosystem — dev.to, Hacker News, Reddit, Lobsters, Hashnode, Mastodon, and engineering blogs."
    >
      <ol className="divide-y divide-border">
        {articles.map((item, i) => (
          <NewsEntry key={item.id} item={item} index={i + 1} />
        ))}
      </ol>

      <div className="mt-10">
        <Link
          href="/news"
          className="notebook-serif inline-flex items-baseline gap-2 text-[15px] text-accent italic underline decoration-1 underline-offset-4 transition-colors hover:text-foreground"
        >
          see all news →
        </Link>
      </div>
    </NotebookSection>
  );
}
