/**
 * What a sample request is, on both sides of the wire.
 *
 * The browser sends *what was asked for* — a catalogue id, or the parameters of
 * a made-to-order request — and never a price. Every rupee is recomputed here
 * from the same pure functions the quote panel uses, so a tampered payload
 * cannot buy a chapter pack for one rupee and there is no second pricing rule
 * to keep in sync.
 *
 * Nothing is charged yet: the request buys one free sample, and only the team's
 * work order prints the figure. Pricing stays on this side of the wire
 * regardless — it is the rule that has to be right on the day payment opens,
 * not something to wire up then.
 *
 * One line, not a list. A sample is free, which makes the address the whole of
 * the price, which makes "how many" a policy rather than a quantity. The page
 * is a single-select and this is the copy of that rule a POST cannot get
 * around.
 */

import { type Chapter, chapters, describeChapter, describeContents } from "@/lib/inventory";
import { COPIES, type CustomRequest, describeRequest, quoteFor } from "@/lib/quote";

/** Same shape the admin console accepts; deliberately stricter than the RFC. */
const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export type CartItem =
  | { readonly kind: "chapter"; readonly chapterId: string }
  | { readonly kind: "custom"; readonly request: CustomRequest };

export type OrderLine = {
  readonly title: string;
  readonly meta: string;
  /** What the full set would cost. Nothing is charged for the sample. */
  readonly price: number;
  /** Someone has to sit down and set this one before it can ship. */
  readonly madeToOrder: boolean;
};

export type ResolvedOrder = {
  readonly email: string;
  readonly item: CartItem;
  readonly line: OrderLine;
};

export type OrderValidation =
  | ({ readonly ok: true } & ResolvedOrder)
  | { readonly ok: false; readonly reason: string };

const byId = new Map(chapters.map((c) => [c.id, c] as const));

export function findChapter(id: string): Chapter | undefined {
  return byId.get(id);
}

export function chapterLine(chapter: Chapter): OrderLine {
  return {
    title: chapter.title,
    meta: `${describeChapter(chapter)} · ${describeContents(chapter)}`,
    price: chapter.price,
    madeToOrder: !chapter.inStock,
  };
}

export function customLine(request: CustomRequest): OrderLine {
  const quote = quoteFor(request);
  const chapter = request.chapter.trim();
  return {
    title: `${chapter} — made to order`,
    meta: describeRequest(request, quote),
    price: quote.total,
    madeToOrder: true,
  };
}

/** `null` when the item names a chapter that is no longer in the catalogue. */
export function resolveLine(item: CartItem): OrderLine | null {
  if (item.kind === "chapter") {
    const chapter = findChapter(item.chapterId);
    return chapter ? chapterLine(chapter) : null;
  }
  return customLine(item.request);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim());
}

function parseCustomRequest(value: unknown): CustomRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;

  const chapter = typeof r.chapter === "string" ? r.chapter.trim().slice(0, 160) : "";
  const subject = typeof r.subject === "string" ? r.subject.trim().slice(0, 60) : "";
  if (!chapter || !subject) return null;
  if (r.board !== "CBSE" && r.board !== "ICSE") return null;
  if (r.cls !== "9" && r.cls !== "10") return null;
  if (typeof r.advanced !== "boolean") return null;
  if (typeof r.copies !== "number" || !Number.isFinite(r.copies)) return null;

  // Out-of-range numbers are clamped rather than rejected: `quoteFor` clamps
  // too, so rejecting here would only disagree with the price the panel showed.
  return {
    board: r.board,
    cls: r.cls,
    subject,
    chapter,
    advanced: r.advanced,
    copies: Math.min(COPIES.max, Math.max(COPIES.min, Math.round(r.copies))),
  };
}

export type ItemParse =
  | { readonly ok: true; readonly item: CartItem }
  | { readonly ok: false; readonly reason: string };

/**
 * Reads one untrusted item.
 *
 * Shared by the route handler and the page's own restore-from-storage path:
 * `sessionStorage` is as much outside this program as a POST body is, and
 * whatever wrote it may have been an older build.
 */
export function parseCartItem(value: unknown): ItemParse {
  if (typeof value !== "object" || value === null) {
    return { ok: false, reason: "That item is not readable." };
  }
  const item = value as Record<string, unknown>;

  if (item.kind === "chapter") {
    if (typeof item.chapterId !== "string") {
      return { ok: false, reason: "That item is not readable." };
    }
    if (!findChapter(item.chapterId)) {
      return { ok: false, reason: "That chapter is no longer in the inventory." };
    }
    return { ok: true, item: { kind: "chapter", chapterId: item.chapterId } };
  }

  if (item.kind === "custom") {
    const request = parseCustomRequest(item.request);
    if (!request) {
      return { ok: false, reason: "The custom request is missing something." };
    }
    return { ok: true, item: { kind: "custom", request } };
  }

  return { ok: false, reason: "That item is not readable." };
}

/**
 * Turns an untrusted JSON body into one priced line, or says why it cannot.
 * Pure — the route handler adds no rules of its own.
 */
export function validateOrder(payload: unknown): OrderValidation {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, reason: "Expected a JSON object." };
  }
  const body = payload as Record<string, unknown>;

  if (typeof body.email !== "string" || !isValidEmail(body.email)) {
    return { ok: false, reason: "A delivery email address is required." };
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, reason: "Nothing was picked." };
  }
  if (body.items.length > 1) {
    return { ok: false, reason: "One free sample per email address." };
  }

  const parsed = parseCartItem(body.items[0]);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const line = resolveLine(parsed.item);
  if (!line) return { ok: false, reason: "That chapter is no longer in the inventory." };

  return { ok: true, email: body.email.trim(), item: parsed.item, line };
}
