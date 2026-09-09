import { EventEmitter } from "node:events";
import Redis from "ioredis";

/**
 * Connection management for the realtime bus.
 *
 * Two Redis clients, opened lazily and cached for the life of the process: a
 * subscribed connection cannot issue ordinary commands, so publishing needs its
 * own. Both are cached on `globalThis` because the dev server re-evaluates
 * modules on every edit, and a fresh pair per edit exhausts the connection
 * limit within a few minutes.
 *
 * Without `REDIS_URL` everything falls back to an in-process emitter, which is
 * correct for a single server and is what local development runs on.
 */

/** One Redis channel for every logical channel; the envelope says which. */
const REDIS_CHANNEL = "byteveda:admin";

export type Envelope = { channel: string; payload: unknown };

const globalForRealtime = globalThis as typeof globalThis & {
  __bvBus?: EventEmitter;
  __bvPublisher?: Redis | null;
  __bvSubscriber?: Redis | null;
  __bvReady?: Promise<void>;
};

export function localBus(): EventEmitter {
  if (!globalForRealtime.__bvBus) {
    const emitter = new EventEmitter();
    // One listener per open stream, and no meaningful ceiling on those.
    emitter.setMaxListeners(0);
    globalForRealtime.__bvBus = emitter;
  }
  return globalForRealtime.__bvBus;
}

export function isDistributed(): boolean {
  return Boolean(process.env.REDIS_URL);
}

function connect(role: string): Redis {
  const client = new Redis(process.env.REDIS_URL as string, {
    // A console is not worth crashing over. ioredis reconnects on its own; in
    // the meantime an announcement is dropped rather than queued forever.
    maxRetriesPerRequest: 3,
    // Back off quickly at first, then stop hammering a service that is down.
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  client.on("error", (error) => console.error(`[realtime] ${role}: ${error.message}`));
  return client;
}

function publisher(): Redis | null {
  if (globalForRealtime.__bvPublisher === undefined) {
    globalForRealtime.__bvPublisher = isDistributed() ? connect("publisher") : null;
  }
  return globalForRealtime.__bvPublisher;
}

/**
 * Opens the single subscription this process needs, the first time anything
 * listens. Messages are routed onto the local bus by channel name, so a
 * consumer never touches Redis directly.
 */
export function ensureSubscribed(): void {
  if (globalForRealtime.__bvSubscriber !== undefined || !isDistributed()) return;

  const client = connect("subscriber");
  globalForRealtime.__bvSubscriber = client;

  // Redis drops a publication that arrives before SUBSCRIBE completes — there
  // is no backlog. Anything that publishes right after subscribing has to wait
  // on this or it will announce into an empty room.
  globalForRealtime.__bvReady = new Promise<void>((resolve) => {
    client.subscribe(REDIS_CHANNEL, (error) => {
      if (error) console.error(`[realtime] could not subscribe: ${error.message}`);
      resolve();
    });
  });

  client.on("message", (channel, raw) => {
    if (channel !== REDIS_CHANNEL) return;
    try {
      const { channel: name, payload } = JSON.parse(raw) as Envelope;
      localBus().emit(name, payload);
    } catch {
      console.error("[realtime] dropped an unreadable message");
    }
  });

  // Redis replays nothing after a reconnect, so a consumer that cares about
  // missed events should re-read on its own. Saying so is cheaper than
  // pretending the gap does not exist.
  client.on("reconnecting", () => console.warn("[realtime] subscriber reconnecting"));
}

/**
 * Publishes, or emits locally when Redis is absent or unreachable.
 *
 * Fire-and-forget on purpose: the caller has already done the work that
 * matters, and a Redis blip must not fail a subscription confirmation.
 */
export function dispatch(channel: string, payload: unknown): void {
  const client = publisher();

  if (!client) {
    localBus().emit(channel, payload);
    return;
  }

  client.publish(REDIS_CHANNEL, JSON.stringify({ channel, payload })).catch((error) => {
    console.error(`[realtime] publish failed: ${error.message}`);
    // Local listeners should still see it even when Redis is unreachable.
    localBus().emit(channel, payload);
  });
}

/**
 * Resolves once this process is actually subscribed.
 *
 * Only a caller that publishes immediately after subscribing needs it — a
 * long-lived stream is subscribed long before anything is announced.
 */
export async function subscriberReady(): Promise<void> {
  ensureSubscribed();
  await globalForRealtime.__bvReady;
}

/** For scripts and tests. The server never calls this. */
export async function closeRealtime(): Promise<void> {
  await Promise.all([
    globalForRealtime.__bvPublisher?.quit(),
    globalForRealtime.__bvSubscriber?.quit(),
  ]);
  globalForRealtime.__bvPublisher = undefined;
  globalForRealtime.__bvSubscriber = undefined;
  globalForRealtime.__bvReady = undefined;
}
