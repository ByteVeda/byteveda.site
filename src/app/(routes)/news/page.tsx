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
        viewBox="0 0 144 120"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="A stack of notebook pages with handwritten lines and a folded corner"
        className="h-30 w-36"
      >
        <title>A stack of notebook pages with handwritten lines and a folded corner</title>
        <rect x="38" y="14" width="86" height="80" />
        <rect x="28" y="22" width="86" height="80" />
        <path d="M 16 30 L 96 30 L 108 42 L 108 110 L 16 110 Z" />
        <path d="M 96 30 L 96 42 L 108 42" opacity="0.55" />
        <line x1="26" y1="30" x2="26" y2="110" opacity="0.4" />
        <line x1="32" y1="48" x2="92" y2="48" />
        <line x1="32" y1="56" x2="86" y2="56" />
        <line x1="32" y1="64" x2="100" y2="64" />
        <line x1="32" y1="72" x2="76" y2="72" />
        <line x1="32" y1="80" x2="92" y2="80" />
        <line x1="32" y1="88" x2="58" y2="88" />
        <line x1="32" y1="96" x2="84" y2="96" />
        <line x1="32" y1="104" x2="46" y2="104" />
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
