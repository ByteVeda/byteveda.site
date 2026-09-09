import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { subscribe } from "@/lib/events";

export const dynamic = "force-dynamic";
/** Held open until the operator leaves the page or the platform cuts it. */
export const maxDuration = 300;

/** Frequent enough to stay inside proxy idle timeouts, rare enough to be free. */
const HEARTBEAT_MS = 25_000;

/**
 * Pushes subscriber-list changes to an open Subscribers page.
 *
 * A confirmation happens in the subscriber's browser, so the operator's page
 * has no other way to hear about it. The endpoint that performs the change
 * announces it on the in-process bus; this forwards that to the browser.
 *
 * Authenticated by the session cookie, same as every other page — the proxy
 * checks a cookie exists, and this checks it names a live session.
 *
 * An event stream rather than a socket: the traffic is one-way and tiny, and a
 * WebSocket would mean running a custom server instead of `next start`.
 */
export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let open = true;

      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client went away between the check and the write.
          open = false;
        }
      };

      const close = () => {
        if (!open) return;
        open = false;
        clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // Without this the listener outlives the page and the bus leaks one entry
      // per navigation.
      request.signal.addEventListener("abort", close);

      unsubscribe = subscribe("subscribers:changed", () => write("event: change\ndata: 1\n\n"));

      // Lets the client tell a live stream from a silent one.
      write("event: ready\ndata: 1\n\n");
      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
    },

    cancel() {
      clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      // `no-transform` matters: a proxy that buffers defeats the point.
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
