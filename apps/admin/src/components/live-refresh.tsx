"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  /** Server-sent events endpoint emitting a `change` event. */
  endpoint: string;
};

/**
 * Re-renders the page when the data behind it changes.
 *
 * Some changes happen in someone else's browser — a subscriber following a
 * confirmation link — so the open page has no other way to hear about them.
 * A Postgres trigger announces the write, the endpoint forwards it, and this
 * turns it into a refresh.
 *
 * An event stream rather than polling: nothing is sent while nothing happens,
 * and the update is immediate rather than up to an interval late. `EventSource`
 * reconnects by itself when the connection drops, which it will — the server
 * function has a time limit.
 *
 * Renders nothing.
 */
export function LiveRefresh({ endpoint }: Props) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource(endpoint);

    source.addEventListener("change", () => router.refresh());

    // The server could not hold a listener — most likely a transaction-mode
    // pooler, which never delivers. Say so once instead of looking idle.
    source.addEventListener("unavailable", () => {
      console.warn(`[live] ${endpoint} cannot push updates; reload to see changes.`);
      source.close();
    });

    return () => source.close();
  }, [endpoint, router]);

  return null;
}
