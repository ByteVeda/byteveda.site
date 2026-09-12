import type { ThreadFilter } from "./queries";

export type InboxParams = {
  thread?: string | null;
  filter?: ThreadFilter;
  query?: string;
};

/**
 * The inbox is its URL.
 *
 * Which conversation is open, which filter is showing and what was searched for
 * are all in the query string, so every one of them survives a reload, a link
 * sent to yourself, and the back button. That only holds if every link carries
 * the other two, which is why nothing builds these by hand.
 *
 * The default filter is left out rather than written as `f=inbox`: the plain
 * `/inbox` is the address of the inbox.
 */
export function inboxHref(params: InboxParams = {}): string {
  const search = new URLSearchParams();

  if (params.filter && params.filter !== "inbox") search.set("f", params.filter);

  const query = params.query?.trim();
  if (query) search.set("q", query);

  if (params.thread) search.set("t", params.thread);

  const rest = search.toString();
  return rest ? `/inbox?${rest}` : "/inbox";
}
