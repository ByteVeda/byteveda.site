"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { cn } from "@/lib/cn";
import type { Label, NewsItem, NewsSource } from "../types";
import { LABELS, NEWS_SOURCES } from "../types";
import { NewsEntry } from "./news-entry";
import type { Filters } from "./news-filters";
import { NewsFilters } from "./news-filters";

type NewsListProps = {
  items: NewsItem[];
  pageSize?: number;
};

function readSet<T extends string>(raw: string | null, valid: readonly T[]): Set<T> {
  if (!raw) return new Set();
  const allowed = valid as readonly string[];
  return new Set(
    raw
      .split(",")
      .map((v) => v.trim())
      .filter((v): v is T => allowed.includes(v)),
  );
}

function setToParam(values: Set<string>): string | null {
  return values.size === 0 ? null : Array.from(values).join(",");
}

function matchesFilters(item: NewsItem, f: Filters): boolean {
  if (f.featured && !item.mentionsByteveda) return false;
  if (f.sources.size > 0 && !f.sources.has(item.source)) return false;
  if (f.labels.size > 0 && !item.labels.some((l) => f.labels.has(l))) return false;
  const q = f.q.trim().toLowerCase();
  if (q) {
    const hay = `${item.title} ${item.excerpt ?? ""} ${item.author ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function NewsList({ items, pageSize = 9 }: NewsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: Filters = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      sources: readSet(searchParams.get("src"), NEWS_SOURCES),
      labels: readSet(searchParams.get("lbl"), LABELS),
      featured: searchParams.get("featured") === "1",
    }),
    [searchParams],
  );

  const filtered = useMemo(
    () => items.filter((item) => matchesFilters(item, filters)),
    [items, filters],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requested = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(requested) ? Math.min(Math.max(1, requested), totalPages) : 1;

  const startIndex = (page - 1) * pageSize;

  const visible = useMemo(
    () => filtered.slice(startIndex, startIndex + pageSize),
    [filtered, startIndex, pageSize],
  );

  const updateParams = useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      opts: { resetPage?: boolean; scroll?: boolean } = {},
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      if (opts.resetPage) params.delete("page");
      const qs = params.toString();
      router.push(qs ? `/news?${qs}` : "/news", { scroll: false });
      if (opts.scroll && typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [router, searchParams],
  );

  const goTo = useCallback(
    (next: number) => {
      const target = Math.min(Math.max(1, next), totalPages);
      updateParams(
        (p) => {
          if (target === 1) p.delete("page");
          else p.set("page", String(target));
        },
        { scroll: true },
      );
    },
    [totalPages, updateParams],
  );

  const handleSearchChange = useCallback(
    (q: string) => {
      updateParams(
        (p) => {
          if (q.trim() === "") p.delete("q");
          else p.set("q", q);
        },
        { resetPage: true },
      );
    },
    [updateParams],
  );

  const toggleInSet = useCallback(
    <T extends string>(key: string, value: T, current: Set<T>) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      updateParams(
        (p) => {
          const serialized = setToParam(next);
          if (serialized === null) p.delete(key);
          else p.set(key, serialized);
        },
        { resetPage: true },
      );
    },
    [updateParams],
  );

  const handleToggleSource = useCallback(
    (source: NewsSource) => toggleInSet("src", source, filters.sources),
    [filters.sources, toggleInSet],
  );

  const handleToggleLabel = useCallback(
    (label: Label) => toggleInSet("lbl", label, filters.labels),
    [filters.labels, toggleInSet],
  );

  const handleToggleFeatured = useCallback(() => {
    updateParams(
      (p) => {
        if (filters.featured) p.delete("featured");
        else p.set("featured", "1");
      },
      { resetPage: true },
    );
  }, [filters.featured, updateParams]);

  const handleClear = useCallback(() => {
    updateParams(
      (p) => {
        p.delete("q");
        p.delete("src");
        p.delete("lbl");
        p.delete("featured");
      },
      { resetPage: true },
    );
  }, [updateParams]);

  if (items.length === 0) {
    return (
      <p className="notebook-serif mt-12 text-base text-muted-foreground italic">
        Nothing in the catalog yet. The feed refreshes every few hours — check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <NewsFilters
        items={items}
        filters={filters}
        totalCount={items.length}
        filteredCount={filtered.length}
        onSearchChange={handleSearchChange}
        onToggleSource={handleToggleSource}
        onToggleLabel={handleToggleLabel}
        onToggleFeatured={handleToggleFeatured}
        onClear={handleClear}
      />

      <div aria-hidden className="border-border border-t" />

      {filtered.length === 0 ? (
        <p className="notebook-serif text-base text-muted-foreground italic">
          No entries match these filters.{" "}
          <button
            type="button"
            onClick={handleClear}
            className="text-accent underline decoration-1 underline-offset-4 transition-colors hover:text-foreground"
          >
            clear filters
          </button>
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {visible.map((item, i) => (
            <NewsEntry key={item.id} item={item} index={startIndex + i + 1} />
          ))}
        </ol>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="News pagination"
          className="notebook-mono flex items-center justify-between border-border border-t pt-6 text-[12px] tabular-nums"
        >
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className={cn(
              "transition-colors",
              page === 1
                ? "pointer-events-none text-muted-foreground/40"
                : "text-accent hover:underline hover:underline-offset-4",
            )}
          >
            ← previous
          </button>

          <span className="text-muted-foreground">
            p. {page} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className={cn(
              "transition-colors",
              page === totalPages
                ? "pointer-events-none text-muted-foreground/40"
                : "text-accent hover:underline hover:underline-offset-4",
            )}
          >
            next →
          </button>
        </nav>
      )}
    </div>
  );
}
