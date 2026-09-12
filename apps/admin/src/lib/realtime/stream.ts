import type { NextRequest } from "next/server";

/**
 * Server-sent events, with the plumbing in one place.
 *
 * Every live endpoint in the console needs the same four things: an encoder, a
 * heartbeat that keeps proxies from closing an idle connection, a teardown that
 * runs exactly once however the connection ends, and a guard against writing to
 * a controller the client already abandoned. Written out per route, that is
 * sixty lines of ceremony around one `subscribe` call.
 *
 * An event stream rather than a socket: the traffic is one-way and tiny, and a
 * WebSocket would mean running a custom server instead of `next start`.
 */

/** Frequent enough to stay inside proxy idle timeouts, rare enough to be free. */
const HEARTBEAT_MS = 25_000;

export type Stream = {
  /** Sends a named event. An object payload is JSON; anything else is `1`. */
  send: (event: string, data?: unknown) => void;
  close: () => void;
};

/**
 * `open` runs once the stream is live and returns its teardown — typically the
 * unsubscribe handle from a channel. It is called whether the client navigated
 * away, the platform cut the function, or the stream closed itself.
 */
export function eventStream(
  request: NextRequest,
  open: (stream: Stream) => (() => void) | void,
): Response {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  let teardown: (() => void) | undefined;
  let torndown = false;
  /** Set when the stream closed before `open` had returned its teardown. */
  let deferred = false;

  /**
   * Runs the teardown at most once, whichever of the three ways the stream ends
   * gets there first — the client aborting, the consumer cancelling, or the
   * stream closing itself.
   *
   * The deferral is the subtle part: `open` can close the stream before it
   * returns, and there is nothing to run yet at that moment.
   */
  const release = () => {
    if (torndown) return;
    if (!teardown) {
      deferred = true;
      return;
    }
    torndown = true;
    teardown();
  };

  const body = new ReadableStream({
    start(controller) {
      let live = true;

      const write = (chunk: string) => {
        if (!live) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client went away between the check and the write.
          live = false;
        }
      };

      const stream: Stream = {
        send(event, data) {
          const payload = typeof data === "object" && data !== null ? JSON.stringify(data) : "1";
          write(`event: ${event}\ndata: ${payload}\n\n`);
        },

        close() {
          if (!live) return;
          live = false;
          clearInterval(heartbeat);
          release();
          try {
            controller.close();
          } catch {
            // Already closed.
          }
        },
      };

      // Both before `open` runs: without the listener the subscription outlives
      // the page and the bus leaks one entry per navigation, and a heartbeat
      // started afterwards would survive a stream that `open` closed on the spot.
      request.signal.addEventListener("abort", stream.close);
      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      teardown = open(stream) ?? undefined;

      // `open` closed the stream itself: everything but the teardown has already
      // happened, and `close` would now return early.
      if (deferred) release();
      // Or the client was gone before any of this ran, in which case the abort
      // listener above was registered too late to ever fire.
      else if (request.signal.aborted) stream.close();
    },

    cancel() {
      clearInterval(heartbeat);
      release();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      // `no-transform` matters: a proxy that buffers defeats the point.
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
