"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { openThread } from "@/lib/inbox/actions";

type Props = {
  threadKey: string;
  /** False once the thread is read and every message has its body. */
  pending: boolean;
};

/**
 * Tells the server a conversation was opened, and reports back when that could
 * not finish.
 *
 * The call happens from the browser, deliberately. Doing it while rendering was
 * two bugs: the action ends in `revalidatePath`, which Next refuses to run
 * inside a render, and Next prefetches `<Link>` targets — so marking read
 * server-side meant hovering a thread in the list marked it read without anyone
 * opening it.
 *
 * Renders nothing until something goes wrong. A conversation with no body in it
 * is otherwise indistinguishable from a misconfigured API key, which is exactly
 * how a sending-only `RESEND_API_KEY` went unnoticed.
 */
export function ThreadOpener({ threadKey, pending }: Props) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;

    let live = true;
    openThread(threadKey)
      .then((opened) => {
        if (live) setError(opened.error);
      })
      .catch((cause) => {
        console.error("[inbox] could not open the conversation", cause);
        if (live) setError("The console could not open this conversation.");
      });

    return () => {
      live = false;
    };
  }, [threadKey, pending]);

  if (!error) return null;

  return (
    <p className="notice notice-warn thread-notice" role="status">
      <TriangleAlert aria-hidden />
      <span>This conversation has no message body. {error}</span>
    </p>
  );
}
