"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { type CartItem, type OrderLine, parseCartItem, resolveLine } from "@/lib/orders/model";
import type { CustomRequest } from "@/lib/quote";

type SampleContextValue = {
  /** What was picked, or nothing. One free sample per address. */
  item: CartItem | null;
  /** The picked item, priced and described. Null when nothing is picked. */
  line: OrderLine | null;
  /** False until the saved pick has been read back. Renders wait on it. */
  ready: boolean;
  /** True when this is the picked chapter. */
  holds: (chapterId: string) => boolean;
  /** Picks a chapter, replacing whatever was picked. The same one again clears it. */
  pickChapter: (chapterId: string) => void;
  pickCustom: (request: CustomRequest) => void;
  clear: () => void;
};

const SampleContext = createContext<SampleContextValue | null>(null);

/** Versioned: a shape change should drop an old pick, not try to read it. */
const STORAGE_KEY = "academy.sample.v2";

function restore(): CartItem | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // Re-validated, not trusted: the tab may have been left open across a
    // deploy that renamed a chapter or changed what a request may contain.
    const parsed = parseCartItem(JSON.parse(raw));
    return parsed.ok ? parsed.item : null;
  } catch {
    return null;
  }
}

/**
 * The one chapter someone wants a sample of, held for the length of the tab.
 *
 * A single value rather than a list, because that is the rule: a sample costs
 * nothing, so the address is the whole of the price, and one address buys one.
 * Picking a second chapter moves the pick rather than adding to it — a
 * disabled row would leave someone who changed their mind with no way forward
 * but a page they have not found yet.
 *
 * `sessionStorage` rather than component state alone, because the request is
 * its own page: a reload of /sample, or a link opened from a chat, has to find
 * the pick still there. Not `localStorage` — a pick resurrected next week would
 * name a catalogue that has moved on. Nothing priced is stored either; the line
 * is re-derived from the catalogue on every render.
 */
export function SampleProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<CartItem | null>(null);
  const [ready, setReady] = useState(false);

  // Read after mount, never during render: the server has no session storage,
  // and reading it in the first render would hydrate against a different tree.
  useEffect(() => {
    setItem(restore());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      if (item) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(item));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private mode, or a full quota. The pick still works for this page.
    }
  }, [item, ready]);

  const holds = useCallback(
    (chapterId: string) => item?.kind === "chapter" && item.chapterId === chapterId,
    [item],
  );

  const pickChapter = useCallback((chapterId: string) => {
    setItem((current) =>
      current?.kind === "chapter" && current.chapterId === chapterId
        ? null
        : { kind: "chapter", chapterId },
    );
  }, []);

  const pickCustom = useCallback((request: CustomRequest) => {
    setItem({ kind: "custom", request });
  }, []);

  const clear = useCallback(() => setItem(null), []);

  const line = useMemo(() => (item ? resolveLine(item) : null), [item]);

  const value = useMemo<SampleContextValue>(
    () => ({ item, line, ready, holds, pickChapter, pickCustom, clear }),
    [item, line, ready, holds, pickChapter, pickCustom, clear],
  );

  return <SampleContext.Provider value={value}>{children}</SampleContext.Provider>;
}

export function useSamples(): SampleContextValue {
  const value = useContext(SampleContext);
  if (!value) throw new Error("useSamples must be used inside <SampleProvider>");
  return value;
}
