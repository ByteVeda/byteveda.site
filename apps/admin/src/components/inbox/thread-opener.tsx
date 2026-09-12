"use client";

import { useEffect } from "react";
import { openThread } from "@/lib/inbox/actions";

type Props = {
  threadKey: string;
  /** False once the thread is read and every message has its body. */
  pending: boolean;
};

/**
 * Tells the server a conversation was opened.
 *
 * From the browser, deliberately. Doing it while rendering was two bugs: the
 * action ends in `revalidatePath`, which Next refuses to run inside a render,
 * and Next prefetches `<Link>` targets — so hovering a thread in the list
 * rendered its page and marked it read without anyone opening it.
 *
 * Renders nothing.
 */
export function ThreadOpener({ threadKey, pending }: Props) {
  useEffect(() => {
    if (!pending) return;

    // Nothing here waits on the result: the action revalidates the page, and a
    // failure is already logged server-side. The worst case is a thread that
    // stays bold.
    openThread(threadKey).catch((error) => {
      console.error("[inbox] could not open the conversation", error);
    });
  }, [threadKey, pending]);

  return null;
}
