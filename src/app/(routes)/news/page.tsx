import type { Metadata } from "next";
import { Suspense } from "react";
import { getArticles, NewsList } from "@/features/news";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "News",
  description: `Articles and discussions from across the open-source ecosystem, aggregated for ${site.name}.`,
  alternates: { canonical: `${site.url}/news` },
};

const PAGE_SIZE = 9;

function NewsListFallback() {
  return (
    <div className="space-y-10">
      <div className="h-24 animate-pulse rounded-sm bg-muted/40" />
      <div className="border-border border-t" />
      <ol className="divide-y divide-border">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="py-7 pl-6">
            <div className="h-3 w-48 animate-pulse rounded-sm bg-muted/50" />
            <div className="mt-3 h-7 w-3/4 animate-pulse rounded-sm bg-muted/40" />
            <div className="mt-3 h-4 w-2/3 animate-pulse rounded-sm bg-muted/30" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function CatalogFigure() {
  return (
    <figure className="hidden flex-shrink-0 text-muted-foreground md:block">
      <svg
        viewBox="0 0 120 96"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="square"
        strokeLinejoin="miter"
        role="img"
        aria-label="A stack of three offset paper sheets"
        className="h-24 w-30"
      >
        <title>A stack of three offset paper sheets</title>
        <rect x="22" y="14" width="76" height="60" />
        <rect x="14" y="22" width="76" height="60" />
        <rect x="6" y="30" width="76" height="60" />
        <line x1="14" y1="44" x2="74" y2="44" />
        <line x1="14" y1="52" x2="68" y2="52" />
        <line x1="14" y1="60" x2="74" y2="60" />
        <line x1="14" y1="68" x2="50" y2="68" />
        <line x1="14" y1="76" x2="68" y2="76" />
        <line x1="14" y1="84" x2="40" y2="84" />
      </svg>
      <figcaption className="notebook-mono mt-2 text-[10px] text-muted-foreground tracking-wide">
        FIG.1 — the catalog
      </figcaption>
    </figure>
  );
}

export default function NewsPage() {
  const items = getArticles();

  return (
    <div className="mx-auto max-w-5xl px-6 py-20 md:px-10 md:py-28">
      <header className="flex items-start justify-between gap-10">
        <div className="flex-1">
          <p className="notebook-mono flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
            <span>§ 02</span>
            <span aria-hidden>·</span>
            <span>lab notebook</span>
          </p>

          <h1 className="notebook-headline mt-6 font-medium text-6xl text-foreground leading-[0.95] md:text-7xl">
            News
          </h1>

          <p className="notebook-serif mt-5 flex items-baseline gap-3 text-[15px] text-muted-foreground italic">
            <span aria-hidden className="text-muted-foreground/60">
              ───
            </span>
            from the community
          </p>

          <p className="notebook-serif mt-8 max-w-2xl text-[17px] text-foreground/85 leading-[1.7]">
            Articles and discussions from across the open-source ecosystem — aggregated from dev.to,
            Hacker News, Reddit, Lobsters, Hashnode, Mastodon, and engineering blogs, with a side of
            release notes and trending repositories. Refreshed every few hours.
          </p>
        </div>

        <CatalogFigure />
      </header>

      <hr className="mt-14 border-border" aria-hidden />

      <div className="mt-14">
        <Suspense fallback={<NewsListFallback />}>
          <NewsList items={items} pageSize={PAGE_SIZE} />
        </Suspense>
      </div>

      <footer className="notebook-mono mt-20 flex items-center justify-between border-border border-t pt-6 text-[10px] text-muted-foreground tracking-[0.18em]">
        <span>BYTEVEDA — LAB NOTEBOOK</span>
        <span>NEWS / § 02</span>
      </footer>
    </div>
  );
}
