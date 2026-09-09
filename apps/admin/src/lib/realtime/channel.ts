import { dispatch, ensureSubscribed, localBus } from "./client";

export type Channel<T> = {
  readonly name: string;
  /** Announces to every instance. Fire-and-forget. */
  publish: (payload: T) => void;
  /** Returns the unsubscribe function; callers must run it when they stop caring. */
  subscribe: (listener: (payload: T) => void) => () => void;
};

/**
 * Declares a typed channel.
 *
 * The payload type is the point: a consumer gets what the producer sent without
 * either of them agreeing on a shape by convention. Use `void` for a channel
 * that only says "something changed, go and look".
 *
 *   const postsChanged = defineChannel<{ site: string }>("posts:changed");
 *   postsChanged.publish({ site: "flexiq" });
 *   const stop = postsChanged.subscribe(({ site }) => …);
 *
 * Declare channels in `channels.ts` rather than inline, so the set of them is
 * readable in one place and two callers cannot drift on a name.
 */
export function defineChannel<T = void>(name: string): Channel<T> {
  return {
    name,

    publish(payload: T) {
      dispatch(name, payload);
    },

    subscribe(listener) {
      // Opening the Redis subscription here, rather than at import time, keeps
      // a process that only ever publishes from holding a connection it never
      // reads — a cron invocation, for instance.
      ensureSubscribed();

      const handler = (payload: T) => listener(payload);
      localBus().on(name, handler);

      return () => {
        localBus().off(name, handler);
      };
    },
  };
}
