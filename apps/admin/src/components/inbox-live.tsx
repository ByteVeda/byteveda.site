"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type InboxLive = {
  /** Unread messages across every conversation. */
  unread: number;
  /** Bumped each time the mail itself changed. Nothing reads the number. */
  revision: number;
};

const InboxLiveContext = createContext<InboxLive>({ unread: 0, revision: 0 });

/**
 * One event stream for the whole console.
 *
 * Mail arrives at a webhook rather than at anything the operator did, so a page
 * left open would otherwise sit stale until someone reloaded it. This holds the
 * connection at the layout, above every page, and hands the result down: the
 * rail badge reads `unread`, and the Inbox reads `revision`.
 *
 * Held here rather than by each consumer because a browser allows a small number
 * of connections per origin, and two components opening their own would spend
 * them on the same messages.
 *
 * `unread` starts at the server-rendered count and is corrected by the stream.
 * A later server render still wins over an earlier stream message — which is
 * what keeps the badge right when `REDIS_URL` is unset and announcements cannot
 * cross between serverless instances.
 */
export function InboxLiveProvider({
  unread,
  children,
}: {
  unread: number;
  children: React.ReactNode;
}) {
  const [live, setLive] = useState<InboxLive>({ unread, revision: 0 });
  const [rendered, setRendered] = useState(unread);

  if (rendered !== unread) {
    setRendered(unread);
    setLive((previous) => ({ ...previous, unread }));
  }

  useEffect(() => {
    // `EventSource` reconnects by itself when the connection drops, which it
    // will — the server function has a time limit. Each reconnection re-sends
    // the count, so a gap costs at most a stale badge until it closes.
    const source = new EventSource("/api/inbox/stream");

    source.addEventListener("unread", (event) => {
      const count = readCount(event.data);
      if (count !== null) setLive((previous) => ({ ...previous, unread: count }));
    });

    source.addEventListener("change", () => {
      setLive((previous) => ({ ...previous, revision: previous.revision + 1 }));
    });

    return () => source.close();
  }, []);

  // `live` is already the one object identity per update; memoising it would
  // only be memoising the state hook.
  return <InboxLiveContext.Provider value={live}>{children}</InboxLiveContext.Provider>;
}

function readCount(data: string): number | null {
  try {
    const { unread } = JSON.parse(data) as { unread?: number };
    return typeof unread === "number" ? unread : null;
  } catch {
    return null;
  }
}

/** Unread messages across every conversation, live. */
export function useInboxUnread(): number {
  return useContext(InboxLiveContext).unread;
}

/**
 * Re-renders the Inbox when the mail behind it changes.
 *
 * Mounted by the page rather than the layout: only this page shows the messages
 * themselves, and every other page would pay for a render it does not use.
 *
 * Renders nothing.
 */
export function InboxAutoRefresh() {
  const router = useRouter();
  const { revision } = useContext(InboxLiveContext);
  const seen = useRef(revision);

  useEffect(() => {
    if (seen.current === revision) return;
    seen.current = revision;
    router.refresh();
  }, [revision, router]);

  return null;
}
