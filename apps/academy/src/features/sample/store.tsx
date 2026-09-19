"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { type CartEntry, type OrderLine, parseCartItem, resolveLine } from "@/lib/orders/model";
import type { CustomRequest } from "@/lib/quote";

export type SampleRow = { key: string; line: OrderLine };

type SampleContextValue = {
  entries: readonly CartEntry[];
  rows: readonly SampleRow[];
  count: number;
  /** False until the saved request has been read back. Renders wait on it. */
  ready: boolean;
  /** True when this chapter is already picked. */
  holds: (chapterId: string) => boolean;
  toggleChapter: (chapterId: string) => void;
  addCustom: (request: CustomRequest) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const SampleContext = createContext<SampleContextValue | null>(null);

/** Versioned: a shape change should drop old lists, not try to read them. */
const STORAGE_KEY = "academy.samples.v1";

const chapterKey = (chapterId: string) => `chapter:${chapterId}`;

const customKey = () =>
  `custom:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function restore(): CartEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];

    // Re-validated, not trusted: the tab may have been left open across a
    // deploy that renamed a chapter or changed what a request may contain.
    return saved.flatMap((value) => {
      const parsed = parseCartItem(value);
      if (!parsed.ok) return [];
      const key =
        typeof (value as { key?: unknown }).key === "string"
          ? (value as { key: string }).key
          : customKey();
      return [{ ...parsed.item, key } as CartEntry];
    });
  } catch {
    return [];
  }
}

/**
 * The chapters someone wants samples of, held for the length of the tab.
 *
 * `sessionStorage` rather than component state alone, because the request is its
 * own page now: a reload of /sample, or a link opened from a chat, has to find
 * the list still there. Not `localStorage` — a list resurrected next week would
 * name a catalogue that has moved on. Nothing priced is stored either; the lines
 * are re-derived from the catalogue on every render.
 */
export function SampleProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly CartEntry[]>([]);
  const [ready, setReady] = useState(false);

  // Read after mount, never during render: the server has no session storage,
  // and reading it in the first render would hydrate against a different tree.
  useEffect(() => {
    setEntries(restore());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Private mode, or a full quota. The order still works for this page.
    }
  }, [entries, ready]);

  const holds = useCallback(
    (chapterId: string) => entries.some((entry) => entry.key === chapterKey(chapterId)),
    [entries],
  );

  const toggleChapter = useCallback((chapterId: string) => {
    const key = chapterKey(chapterId);
    setEntries((current) =>
      current.some((entry) => entry.key === key)
        ? current.filter((entry) => entry.key !== key)
        : [...current, { key, kind: "chapter", chapterId }],
    );
  }, []);

  const addCustom = useCallback((request: CustomRequest) => {
    setEntries((current) => [...current, { key: customKey(), kind: "custom", request }]);
  }, []);

  const remove = useCallback((key: string) => {
    setEntries((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const rows = useMemo(
    () =>
      entries.flatMap((entry) => {
        const line = resolveLine(entry);
        return line ? [{ key: entry.key, line }] : [];
      }),
    [entries],
  );

  const value = useMemo<SampleContextValue>(
    () => ({
      entries,
      rows,
      count: entries.length,
      ready,
      holds,
      toggleChapter,
      addCustom,
      remove,
      clear,
    }),
    [entries, rows, ready, holds, toggleChapter, addCustom, remove, clear],
  );

  return <SampleContext.Provider value={value}>{children}</SampleContext.Provider>;
}

export function useSamples(): SampleContextValue {
  const value = useContext(SampleContext);
  if (!value) throw new Error("useSamples must be used inside <SampleProvider>");
  return value;
}
