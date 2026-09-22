"use client";

import { useEffect, useRef } from "react";

/** What a key does. Keys are matched as `event.key`, so they are case-sensitive. */
export type Shortcuts = Record<string, () => void>;

/**
 * Single-key shortcuts for the inbox.
 *
 * Mail is the one screen in a console where hands stay on the keyboard, and
 * `j`/`k`/`e` are what every mail client has trained people to expect.
 *
 * Two rules make them safe to bind globally. Nothing fires while the caret is
 * in a field, or `e` would be unusable in the reply box; and nothing fires with
 * a modifier held, or this would shadow ⌘E, ⌘K and every browser shortcut the
 * operator already has.
 *
 * Handlers are read through a ref so that a component re-rendering with a new
 * closure does not tear down and re-attach the listener on every keystroke.
 */
export function useShortcuts(shortcuts: Shortcuts, enabled = true): void {
  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const handler = latest.current[event.key];
      if (!handler) return;

      event.preventDefault();
      handler();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
