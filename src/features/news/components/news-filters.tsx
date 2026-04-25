"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Label, NewsItem, NewsSource } from "../types";
import { LABELS, NEWS_SOURCES } from "../types";
import { sourceLabel } from "../utils";

export type Filters = {
  q: string;
  sources: Set<NewsSource>;
  labels: Set<Label>;
  featured: boolean;
};

type NewsFiltersProps = {
  items: NewsItem[];
  filters: Filters;
  totalCount: number;
  filteredCount: number;
  onSearchChange: (q: string) => void;
  onToggleSource: (source: NewsSource) => void;
  onToggleLabel: (label: Label) => void;
  onToggleFeatured: () => void;
  onClear: () => void;
};

const SEARCH_DEBOUNCE_MS = 250;

function legendTermClass(active: boolean) {
  return cn(
    "inline-flex items-baseline gap-1 transition-colors",
    active
      ? "text-accent underline decoration-1 decoration-accent underline-offset-4"
      : "text-muted-foreground hover:text-accent hover:underline hover:decoration-1 hover:decoration-accent hover:underline-offset-4",
  );
}

export function NewsFilters({
  items,
  filters,
  totalCount,
  filteredCount,
  onSearchChange,
  onToggleSource,
  onToggleLabel,
  onToggleFeatured,
  onClear,
}: NewsFiltersProps) {
  const searchId = useId();

  const sourceCounts = useMemo(() => {
    const counts = new Map<NewsSource, number>();
    for (const item of items) counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
    return counts;
  }, [items]);

  const labelCounts = useMemo(() => {
    const counts = new Map<Label, number>();
    for (const item of items) {
      for (const label of item.labels) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return counts;
  }, [items]);

  const sourceOptions = useMemo(
    () => NEWS_SOURCES.filter((s) => (sourceCounts.get(s) ?? 0) > 0),
    [sourceCounts],
  );

  const labelOptions = useMemo(
    () => LABELS.filter((l) => (labelCounts.get(l) ?? 0) > 0),
    [labelCounts],
  );

  const [draft, setDraft] = useState(filters.q);
  const lastPushed = useRef(filters.q);

  useEffect(() => {
    if (filters.q !== lastPushed.current) {
      setDraft(filters.q);
      lastPushed.current = filters.q;
    }
  }, [filters.q]);

  useEffect(() => {
    if (draft === lastPushed.current) return;
    const handle = window.setTimeout(() => {
      lastPushed.current = draft;
      onSearchChange(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draft, onSearchChange]);

  const hasFilters =
    filters.q !== "" || filters.sources.size > 0 || filters.labels.size > 0 || filters.featured;

  return (
    <section aria-label="Filter the catalog" className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
        <label
          htmlFor={searchId}
          className="flex min-w-0 flex-1 items-center gap-2 border-border border-b pb-1 transition-colors focus-within:border-accent sm:max-w-md"
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <input
            id={searchId}
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="filter the catalog…"
            className="notebook-serif min-w-0 flex-1 bg-transparent text-[15px] text-foreground italic placeholder:text-muted-foreground focus:outline-none"
          />
        </label>

        <div className="notebook-serif flex items-baseline gap-3 text-[14px] italic">
          <button
            type="button"
            onClick={onToggleFeatured}
            aria-pressed={filters.featured}
            className={legendTermClass(filters.featured)}
          >
            featured only
          </button>
          {hasFilters && (
            <>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={onClear}
                className="text-muted-foreground italic underline decoration-dotted underline-offset-4 transition-colors hover:text-accent"
              >
                clear
              </button>
            </>
          )}
        </div>

        <span className="notebook-mono ml-auto text-[12px] text-muted-foreground tabular-nums">
          {filteredCount} / {totalCount}
        </span>
      </div>

      {sourceOptions.length > 0 && (
        <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <dt className="notebook-smallcaps min-w-[88px] text-[13px] text-foreground">Sources</dt>
          <dd className="notebook-serif flex flex-wrap items-baseline gap-x-2 gap-y-1.5 text-[14px]">
            {sourceOptions.map((source, i) => {
              const active = filters.sources.has(source);
              return (
                <span key={source} className="inline-flex items-baseline gap-2">
                  {i > 0 && (
                    <span className="text-muted-foreground/60" aria-hidden>
                      ·
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleSource(source)}
                    aria-pressed={active}
                    className={legendTermClass(active)}
                  >
                    <span>{sourceLabel(source)}</span>
                    <span className="notebook-mono text-[11px] tabular-nums opacity-60">
                      ({sourceCounts.get(source)})
                    </span>
                  </button>
                </span>
              );
            })}
          </dd>
        </dl>
      )}

      {labelOptions.length > 0 && (
        <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <dt className="notebook-smallcaps min-w-[88px] text-[13px] text-foreground">Topics</dt>
          <dd className="notebook-serif flex flex-wrap items-baseline gap-x-2 gap-y-1.5 text-[14px]">
            {labelOptions.map((label, i) => {
              const active = filters.labels.has(label);
              return (
                <span key={label} className="inline-flex items-baseline gap-2">
                  {i > 0 && (
                    <span className="text-muted-foreground/60" aria-hidden>
                      ·
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleLabel(label)}
                    aria-pressed={active}
                    className={legendTermClass(active)}
                  >
                    <span>{label}</span>
                    <span className="notebook-mono text-[11px] tabular-nums opacity-60">
                      ({labelCounts.get(label)})
                    </span>
                  </button>
                </span>
              );
            })}
          </dd>
        </dl>
      )}
    </section>
  );
}
