"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { ArrowLeft, ArrowRight } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { NewsItem } from "../types";
import { NewsCard } from "./news-card";

type NewsListProps = {
  items: NewsItem[];
  pageSize?: number;
};

type PageEntry = { key: string; value: number | "…" };

function pageNumbers(current: number, total: number): PageEntry[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => ({
      key: String(i + 1),
      value: i + 1,
    }));
  }
  const out: PageEntry[] = [{ key: "1", value: 1 }];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push({ key: "ellipsis-left", value: "…" });
  for (let i = start; i <= end; i += 1) out.push({ key: String(i), value: i });
  if (end < total - 1) out.push({ key: "ellipsis-right", value: "…" });
  out.push({ key: String(total), value: total });
  return out;
}

export function NewsList({ items, pageSize = 9 }: NewsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const requested = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(requested) ? Math.min(Math.max(1, requested), totalPages) : 1;

  const visible = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const pages = useMemo(() => pageNumbers(page, totalPages), [page, totalPages]);

  const goTo = useCallback(
    (next: number) => {
      const target = Math.min(Math.max(1, next), totalPages);
      const params = new URLSearchParams(searchParams.toString());
      if (target === 1) params.delete("page");
      else params.set("page", String(target));
      const qs = params.toString();
      router.push(qs ? `/news?${qs}` : "/news", { scroll: false });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [router, searchParams, totalPages],
  );

  if (items.length === 0) {
    return (
      <p className="mt-12 font-mono text-muted-foreground text-sm">
        Nothing here yet. The feed refreshes every few hours — check back soon.
      </p>
    );
  }

  return (
    <>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="News pagination"
          className="mt-10 flex flex-wrap items-center justify-between gap-4"
        >
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-muted-foreground text-sm",
              "transition-colors hover:border-accent/40 hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Prev
          </button>

          <ul className="flex items-center gap-1.5">
            {pages.map((entry) =>
              entry.value === "…" ? (
                <li
                  key={entry.key}
                  aria-hidden
                  className="px-1 font-mono text-muted-foreground text-sm"
                >
                  …
                </li>
              ) : (
                <li key={entry.key}>
                  <button
                    type="button"
                    onClick={() => goTo(entry.value as number)}
                    aria-current={entry.value === page ? "page" : undefined}
                    className={cn(
                      "h-9 min-w-9 rounded-md border px-2 font-mono text-sm tabular-nums transition-colors",
                      entry.value === page
                        ? "border-accent/40 bg-accent/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
                    )}
                  >
                    {entry.value}
                  </button>
                </li>
              ),
            )}
          </ul>

          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-muted-foreground text-sm",
              "transition-colors hover:border-accent/40 hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            Next
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </nav>
      )}
    </>
  );
}
