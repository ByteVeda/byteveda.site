import { defineChannel } from "@/lib/realtime";

/**
 * The realtime channel this feature owns.
 *
 * It carries no data on purpose. A payload is a second source of truth that
 * can disagree with the database; "something changed, go and look" cannot.
 */
export const postsChanged = defineChannel("posts:changed");
