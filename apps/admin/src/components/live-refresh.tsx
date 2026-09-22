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
 * The code that performs the change announces it on the realtime bus, the
 * endpoint forwards that to the browser, and this turns it into a refresh.
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

    return () => source.close();
  }, [endpoint, router]);

  return null;
}
