import { defineChannel } from "./channel";

/**
 * Every realtime channel in the console, in one place.
 *
 * These carry no data on purpose. A payload is a second source of truth that
 * can disagree with the database; "something changed, go and look" cannot.
 */
export const subscribersChanged = defineChannel("subscribers:changed");
export const inboxChanged = defineChannel("inbox:changed");
export const postsChanged = defineChannel("posts:changed");
