import { describe, expect, it } from "vitest";
import { inboxHref } from "./url";

describe("inboxHref", () => {
  it("is the bare path for the default view", () => {
    expect(inboxHref()).toBe("/inbox");
    expect(inboxHref({ filter: "inbox" })).toBe("/inbox");
  });

  it("keeps the filter and the search together, so neither is lost by the other", () => {
    expect(inboxHref({ filter: "archived", query: "invoice" })).toBe("/inbox?f=archived&q=invoice");
  });

  it("carries the open conversation", () => {
    expect(inboxHref({ thread: "ada@example.test::hello" })).toBe(
      "/inbox?t=ada%40example.test%3A%3Ahello",
    );
  });

  it("escapes a thread key that would otherwise end the query string", () => {
    expect(inboxHref({ thread: "a@b.test::100% off & more" })).toBe(
      "/inbox?t=a%40b.test%3A%3A100%25+off+%26+more",
    );
  });

  it("drops a search that is only whitespace", () => {
    expect(inboxHref({ query: "   " })).toBe("/inbox");
  });

  it("trims the one that is not", () => {
    expect(inboxHref({ query: "  ada  " })).toBe("/inbox?q=ada");
  });

  it("treats a cleared conversation as no conversation", () => {
    expect(inboxHref({ thread: null, filter: "unread" })).toBe("/inbox?f=unread");
  });
});
