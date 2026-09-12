import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { countUnread } from "@/lib/inbox/queries";
import { inboxChanged } from "@/lib/realtime";
import { eventStream } from "@/lib/realtime/stream";

export const dynamic = "force-dynamic";
/** Held open until the operator leaves the console or the platform cuts it. */
export const maxDuration = 300;

/**
 * Pushes mail to an open console.
 *
 * Inbound mail arrives at a webhook, not at anything the operator did, so a page
 * sitting open has no other way to hear about it. The webhook announces on the
 * bus; this forwards that to the browser, which decides what to do with it — the
 * rail re-badges, and an open Inbox re-renders.
 *
 * Two events rather than one. `unread` carries the count, so the badge is right
 * without a round trip; `change` says the list itself moved, which only the
 * Inbox page cares about. A page that wants the badge does not pay for a render.
 *
 * Authenticated by the session cookie, same as every other page — the proxy
 * checks a cookie exists, and this checks it names a live session.
 */
export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return eventStream(request, (stream) => {
    // Serialised: the count is read once per announcement however many arrive
    // at once, and two reads can never land out of order.
    let pending = Promise.resolve();

    const announce = (changed: boolean) => {
      pending = pending
        .then(async () => {
          const unread = await countUnread();
          stream.send("unread", { unread });
          if (changed) stream.send("change", { unread });
        })
        .catch((error) => {
          console.error("[inbox] could not read the unread count", error);
        });
    };

    // The opening count, so a page that mounts with a stale badge corrects
    // itself without waiting for mail to arrive.
    announce(false);

    return inboxChanged.subscribe(() => announce(true));
  });
}
