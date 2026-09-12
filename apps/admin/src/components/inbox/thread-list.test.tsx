import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ThreadCounts, ThreadSummary } from "@/lib/inbox/queries";
import { ThreadList } from "./thread-list";

// The list navigates, so it holds a router. Rendering it outside a request has
// to supply one; nothing here calls it, because effects do not run server-side.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

function thread(overrides: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    threadKey: "ada@example.test::about the queue",
    subject: "About the queue",
    correspondentEmail: "ada@example.test",
    correspondentName: "Ada Lovelace",
    mailbox: "hello@byteveda.org",
    preview: "Does the cap apply before or after the jitter?",
    lastMessageAt: new Date("2026-09-01T10:00:00Z"),
    unread: false,
    archived: false,
    answered: false,
    weSpokeLast: false,
    ...overrides,
  };
}

const counts: ThreadCounts = { inbox: 3, unread: 1, archived: 2 };

function render(threads: ThreadSummary[], props: Partial<Parameters<typeof ThreadList>[0]> = {}) {
  return renderToStaticMarkup(
    <ThreadList
      threads={threads}
      counts={counts}
      filter="inbox"
      query=""
      selected={undefined}
      {...props}
    />,
  );
}

describe("ThreadList", () => {
  it("renders a conversation", () => {
    const markup = render([thread()]);

    expect(markup).toContain("Ada Lovelace");
    expect(markup).toContain("About the queue");
    expect(markup).toContain("Does the cap apply");
  });

  it("marks unread in text as well as with the dot", () => {
    const markup = render([thread({ unread: true })]);

    expect(markup).toContain('data-unread="true"');
    expect(markup).toContain("Unread.");
  });

  it("says whose words the preview is when we spoke last", () => {
    const markup = render([thread({ answered: true, weSpokeLast: true })]);

    expect(markup).toContain("You:");
    expect(markup).toContain("Answered.");
  });

  it("does not claim a conversation is ours when they replied after us", () => {
    const markup = render([thread({ answered: true, weSpokeLast: false })]);

    expect(markup).not.toContain("You:");
    expect(markup).toContain("Answered.");
  });

  it("keeps the search in every link, so a filter does not discard it", () => {
    const markup = render([thread()], { query: "jitter", filter: "unread" });

    expect(markup).toContain("q=jitter");
    // The tabs carry it too — switching filters keeps what was searched for.
    expect(markup).toContain("/inbox?f=archived&amp;q=jitter");
  });

  it("counts each filter", () => {
    const markup = render([thread()]);

    expect(markup).toContain("Archived");
    expect(markup).toContain(">2<");
  });

  it("says why the list is empty when a search found nothing", () => {
    const markup = render([], { query: "nothing" });

    expect(markup).toContain("Nothing matches");
    expect(markup).toContain("nothing");
  });

  it("falls back to the address when a correspondent has no name", () => {
    const markup = render([thread({ correspondentName: null })]);

    expect(markup).toContain("ada@example.test");
  });

  it("shows a placeholder rather than an empty line for a subjectless thread", () => {
    const markup = render([thread({ subject: "" })]);

    expect(markup).toContain("(no subject)");
  });
});
