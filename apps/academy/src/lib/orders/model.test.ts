import { describe, expect, it } from "vitest";

import { type Chapter, chapters } from "@/lib/inventory";
import { validateOrder } from "./model";

function firstStocked(): Chapter {
  const chapter = chapters.find((c) => c.inStock);
  if (!chapter) throw new Error("the catalogue has no stocked chapter to test with");
  return chapter;
}

const stocked = firstStocked();

const custom = {
  kind: "custom",
  request: {
    board: "CBSE",
    cls: "10",
    subject: "Mathematics",
    chapter: "Trigonometry",
    questions: 30,
    difficulty: "board",
    answerKey: "steps",
    copies: 1,
  },
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    email: "student@example.com",
    items: [{ kind: "chapter", chapterId: stocked.id }],
    ...overrides,
  };
}

describe("validateOrder", () => {
  it("prices a catalogue item from the catalogue, not from the payload", () => {
    const result = validateOrder(
      order({ items: [{ kind: "chapter", chapterId: stocked.id, price: 1 }] }),
    );

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.line.price).toBe(stocked.price);
  });

  it("prices a custom request by re-running the quote", () => {
    const result = validateOrder(order({ items: [custom] }));

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.line).toMatchObject({
      title: "Trigonometry — made to order",
      price: 295,
      madeToOrder: true,
    });
  });

  it("keeps the item alongside the line, for the record that gets written", () => {
    const result = validateOrder(order());

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.item).toEqual({ kind: "chapter", chapterId: stocked.id });
  });

  it.each([
    ["a body that is not an object", "nope"],
    ["a missing email", { items: [{ kind: "chapter", chapterId: stocked.id }] }],
    ["an email without a domain", order({ email: "student@example" })],
    ["an empty order", order({ items: [] })],
    ["an item of an unknown kind", order({ items: [{ kind: "subscription" }] })],
    [
      "a chapter that is not stocked at all",
      order({ items: [{ kind: "chapter", chapterId: "nope" }] }),
    ],
    [
      "a custom request with no chapter",
      order({ items: [{ ...custom, request: { ...custom.request, chapter: "  " } }] }),
    ],
    [
      "a custom request with a non-numeric question count",
      order({ items: [{ ...custom, request: { ...custom.request, questions: "lots" } }] }),
    ],
  ])("rejects %s", (_case, payload) => {
    expect(validateOrder(payload).ok).toBe(false);
  });

  it("refuses a second sample in the same request", () => {
    // The page is a single-select; this is the copy of that rule that a
    // hand-rolled POST cannot get around.
    const result = validateOrder(
      order({ items: [{ kind: "chapter", chapterId: stocked.id }, custom] }),
    );

    expect(result).toMatchObject({ ok: false, reason: "One free sample per email address." });
  });

  it("clamps an out-of-range custom request rather than rejecting it", () => {
    const result = validateOrder(
      order({ items: [{ ...custom, request: { ...custom.request, questions: 5000, copies: 0 } }] }),
    );

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.line.meta).toContain("120 questions");
  });

  it("trims the delivery address", () => {
    const result = validateOrder(order({ email: "  student@example.com  " }));

    expect(result).toMatchObject({ ok: true, email: "student@example.com" });
  });
});
