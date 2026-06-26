"use client";

import { useMemo, useState } from "react";
import { Button, RelativeTime } from "@/components/ui";
import { site } from "@/lib/site";
import type { NewsItem } from "../types";
import {
  CATEGORY_FILTER,
  CATEGORY_TAG,
  NEWS_CATEGORIES,
  type NewsCategory,
  newsCategory,
  sourceLabel,
} from "../utils";

type Filter = NewsCategory | "all";

const PAGE_SIZE = 6;

export function NewsFeed({ items }: { items: NewsItem[] }) {
  const withCategory = useMemo(
    () => items.map((item) => ({ item, category: newsCategory(item) })),
    [items],
  );

  // Only offer filters for categories that actually have stories.
  const tabs = useMemo<Filter[]>(() => {
    const present = new Set(withCategory.map((x) => x.category));
    return ["all", ...NEWS_CATEGORIES.filter((c) => present.has(c))];
  }, [withCategory]);

  const [active, setActive] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const visible =
    active === "all" ? withCategory : withCategory.filter((x) => x.category === active);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = visible.slice(start, start + PAGE_SIZE);

  const selectFilter = (tab: Filter) => {
    setActive(tab);
    setPage(1);
  };

  return (
    <section className="section-pad" style={{ paddingTop: "clamp(40px, 5vw, 72px)" }}>
      <div className="wrap">
        <div className="news-toolbar reveal">
          <span className="tb-title">Latest</span>
          <div className="filters" role="tablist" aria-label="Filter news">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active === tab}
                className={active === tab ? "on" : undefined}
                onClick={() => selectFilter(tab)}
              >
                {CATEGORY_FILTER[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="news-grid news-collage reveal">
          {pageItems.length === 0 ? (
            <div className="news-empty">No stories in this category yet.</div>
          ) : (
            pageItems.map(({ item, category }) => (
              <a
                key={item.id}
                className="news-card"
                data-cat={category}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="card-top">
                  <span className="tag" data-cat={category}>
                    {CATEGORY_TAG[category]}
                  </span>
                  <RelativeTime className="when" value={item.publishedAt} />
                </div>
                <h3>{item.title}</h3>
                {item.excerpt && <p>{item.excerpt}</p>}
                <div className="card-foot">
                  <span>
                    {sourceLabel(item.source)}
                    {item.author ? ` · ${item.author}` : ""}
                  </span>
                  <span className="arrow">read →</span>
                </div>
              </a>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <nav className="news-pager" aria-label="News pagination">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              ← prev
            </button>
            <span className="page">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              next →
            </button>
          </nav>
        )}

        <div className="news-more">
          <Button href={`${site.githubUrl}?tab=repositories`} variant="ghost" arrow="→" external>
            All repositories
          </Button>
        </div>
      </div>
    </section>
  );
}
