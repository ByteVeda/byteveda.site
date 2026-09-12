import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { eventStream } from "./stream";

/** `eventStream` only ever touches `signal`; the rest of a request is noise here. */
function requestWith(signal: AbortSignal): NextRequest {
  return { signal } as unknown as NextRequest;
}

async function read(response: Response, frames: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("the stream had no body");

  const decoder = new TextDecoder();
  let text = "";

  for (let i = 0; i < frames; i += 1) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }

  reader.releaseLock();
  return text;
}

describe("eventStream", () => {
  it("announces itself as an event stream a proxy must not buffer", () => {
    const controller = new AbortController();
    const response = eventStream(requestWith(controller.signal), () => {});

    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("cache-control")).toContain("no-transform");
    expect(response.headers.get("x-accel-buffering")).toBe("no");

    // Otherwise the heartbeat keeps the run's event loop alive.
    controller.abort();
  });

  it("writes a named event with a JSON payload, and a bare one without", async () => {
    const controller = new AbortController();
    const response = eventStream(requestWith(controller.signal), (stream) => {
      stream.send("ready");
      stream.send("unread", { unread: 3 });
    });

    expect(await read(response, 2)).toBe(
      'event: ready\ndata: 1\n\nevent: unread\ndata: {"unread":3}\n\n',
    );

    controller.abort();
  });

  it("tears down when the client goes away, so the bus does not leak a listener", () => {
    const controller = new AbortController();
    let listening = true;

    eventStream(requestWith(controller.signal), () => () => {
      listening = false;
    });

    expect(listening).toBe(true);
    controller.abort();
    expect(listening).toBe(false);
  });

  it("tears down once, however many times it is closed", () => {
    const controller = new AbortController();
    let teardowns = 0;

    eventStream(requestWith(controller.signal), (stream) => {
      stream.close();
      stream.close();
      return () => {
        teardowns += 1;
      };
    });

    controller.abort();
    expect(teardowns).toBe(1);
  });

  it("drops writes that arrive after the stream closed rather than throwing", () => {
    const controller = new AbortController();

    expect(() => {
      eventStream(requestWith(controller.signal), (stream) => {
        controller.abort();
        stream.send("change");
      });
    }).not.toThrow();
  });
});
