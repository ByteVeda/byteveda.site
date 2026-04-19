import type { Metadata } from "next";
import { Suspense } from "react";
import { Section, SectionHeader } from "@/components/ui";
import { getArticles, NewsList } from "@/features/news";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "News",
  description: `Articles and discussions from across the open-source ecosystem, aggregated for ${site.name}.`,
  alternates: { canonical: `${site.url}/news` },
};

const PAGE_SIZE = 9;
const SKELETON_KEYS = Array.from({ length: PAGE_SIZE }, (_, i) => `skeleton-${i}`);

function NewsListFallback() {
  return (
    <div aria-hidden className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SKELETON_KEYS.map((key) => (
        <div key={key} className="h-48 animate-pulse rounded-lg border border-border bg-muted/20" />
      ))}
    </div>
  );
}

export default function NewsPage() {
  const items = getArticles();

  return (
    <Section id="news">
      <SectionHeader
        eyebrow="News"
        title="From the community"
        description="Articles and discussions from across the open-source ecosystem — aggregated from dev.to, Hacker News, Reddit, Lobsters, Hashnode, Mastodon, and engineering blogs. Refreshed every few hours."
      />
      <Suspense fallback={<NewsListFallback />}>
        <NewsList items={items} pageSize={PAGE_SIZE} />
      </Suspense>
    </Section>
  );
}
