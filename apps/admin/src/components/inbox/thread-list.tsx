"use client";

import { Archive, CornerUpLeft, Inbox, Mail, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ago, count, initial } from "@/lib/format";
import type { ThreadCounts, ThreadFilter, ThreadSummary } from "@/lib/inbox/queries";
import { inboxHref } from "@/lib/inbox/url";
import { useShortcuts } from "./shortcuts";

type Props = {
  threads: ThreadSummary[];
  counts: ThreadCounts;
  filter: ThreadFilter;
  query: string;
  selected: string | undefined;
};

const TABS: { filter: ThreadFilter; label: string; icon: typeof Inbox }[] = [
  { filter: "inbox", label: "Inbox", icon: Inbox },
  { filter: "unread", label: "Unread", icon: Mail },
  { filter: "archived", label: "Archived", icon: Archive },
];

/** How long after the last keystroke the search runs. */
const DEBOUNCE_MS = 250;

/**
 * The conversation list: search, filters, and the rows themselves.
 *
 * A client component because of the search box and the keyboard, not because of
 * the data — the rows are rendered from what the server already fetched, and
 * every navigation is a `<Link>` to a URL the server can answer on its own.
 */
export function ThreadList({ threads, counts, filter, query, selected }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const searchBox = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLElement>(null);

  const [draft, setDraft] = useState(query);

  /**
   * The search box owns what is typed; the URL owns what was searched for.
   *
   * They have to be reconciled, but only when the URL moved on its own — the
   * back button, or a filter link that dropped the query. Syncing on every
   * change would overwrite the next keystroke with the result of the last one
   * whenever the round trip is slower than the typing.
   */
  const pushed = useRef(query);
  const [urlQuery, setUrlQuery] = useState(query);
  if (query !== urlQuery) {
    setUrlQuery(query);
    if (query !== pushed.current) setDraft(query);
  }

  useEffect(() => {
    if (draft === query) return;

    const timer = setTimeout(() => {
      pushed.current = draft;
      // No thread key: a new search should land on its own first result rather
      // than hold a conversation open that is no longer in the list.
      startTransition(() => {
        router.replace(inboxHref({ filter, query: draft }), { scroll: false });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft, query, filter, router]);

  function step(by: number) {
    if (threads.length === 0) return;

    const current = threads.findIndex((thread) => thread.threadKey === selected);
    // Nothing selected: `j` starts at the top and `k` at the bottom.
    const next = current === -1 ? (by > 0 ? 0 : threads.length - 1) : current + by;

    const thread = threads[Math.max(0, Math.min(threads.length - 1, next))];
    router.push(inboxHref({ thread: thread.threadKey, filter, query }));
  }

  useShortcuts({
    j: () => step(1),
    k: () => step(-1),
    "/": () => searchBox.current?.focus(),
  });

  // Keyboard navigation has to bring its selection into view; a mouse already
  // has. Scoped to the list so the conversation beside it does not move.
  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  return (
    <div className="thread-pane">
      <div className="thread-search">
        <Search aria-hidden />
        <input
          ref={searchBox}
          type="search"
          className="input"
          value={draft}
          placeholder="Search mail"
          aria-label="Search mail"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDraft("");
          }}
        />
        {draft && (
          <button type="button" onClick={() => setDraft("")} aria-label="Clear the search">
            <X aria-hidden />
          </button>
        )}
      </div>

      <nav className="thread-tabs" aria-label="Filter">
        {TABS.map((tab) => (
          <Link
            key={tab.filter}
            href={inboxHref({ filter: tab.filter, query })}
            aria-current={tab.filter === filter}
            scroll={false}
          >
            <tab.icon aria-hidden />
            {tab.label}
            {counts[tab.filter] > 0 && <b>{count(counts[tab.filter])}</b>}
          </Link>
        ))}
      </nav>

      <nav className="thread-list" aria-label="Conversations" ref={list}>
        {threads.length === 0 ? (
          <p className="thread-none">{query ? `Nothing matches “${query}”.` : "Nothing here."}</p>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.threadKey}
              href={inboxHref({ thread: thread.threadKey, filter, query })}
              className="thread-item"
              data-unread={thread.unread}
              aria-current={thread.threadKey === selected}
            >
              <span className="thread-avatar" aria-hidden>
                {initial(thread.correspondentName, thread.correspondentEmail)}
              </span>

              <span className="thread-row">
                <span className="thread-from">
                  {thread.unread && (
                    <>
                      {/* The dot is decoration; the word is what a screen reader gets. */}
                      <i className="thread-unread" aria-hidden />
                      <span className="sr-only">Unread.</span>
                    </>
                  )}
                  <b>{thread.correspondentName ?? thread.correspondentEmail}</b>
                  {thread.answered && (
                    <>
                      <CornerUpLeft className="thread-answered" aria-hidden />
                      <span className="sr-only">Answered.</span>
                    </>
                  )}
                  <time dateTime={thread.lastMessageAt.toISOString()}>
                    {ago(thread.lastMessageAt)}
                  </time>
                </span>

                <span className="thread-subject">{thread.subject || "(no subject)"}</span>

                <span className="thread-preview">
                  {thread.weSpokeLast && <em>You:</em>} {thread.preview}
                </span>
              </span>
            </Link>
          ))
        )}
      </nav>
    </div>
  );
}
