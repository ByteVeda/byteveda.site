import { EventEmitter } from "node:events";

/**
 * An in-process notice board.
 *
 * The subscriber confirms in their own browser, so an open Subscribers page
 * needs telling. The endpoint that performs the change announces it here, and
 * the event stream the console holds open forwards it.
 *
 * In process, deliberately: no database trigger, no polling, nothing to keep in
 * sync. The limit is the flip side — an announcement only reaches streams held
 * by the same server. That is every stream when the console runs as one process;
 * across several serverless instances a change can reach a page held by another
 * one late, on its next navigation. For a console with one operator that trade
 * is worth the simplicity.
 */
export type AdminEvent = "subscribers:changed" | "inbox:changed";

/** Survives dev-server module reloads, which would otherwise orphan listeners. */
const globalForBus = globalThis as typeof globalThis & { __bytevedaBus?: EventEmitter };

function bus(): EventEmitter {
  if (!globalForBus.__bytevedaBus) {
    const emitter = new EventEmitter();
    // One listener per open stream, and no meaningful ceiling on those.
    emitter.setMaxListeners(0);
    globalForBus.__bytevedaBus = emitter;
  }
  return globalForBus.__bytevedaBus;
}

export function announce(event: AdminEvent): void {
  bus().emit(event);
}

/** Returns the unsubscribe function; callers must run it when their stream ends. */
export function subscribe(event: AdminEvent, listener: () => void): () => void {
  bus().on(event, listener);
  return () => {
    bus().off(event, listener);
  };
}
