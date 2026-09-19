/**
 * What an order is, on both sides of the wire.
 *
 * The browser sends *what was asked for* — a catalogue id, or the parameters of
 * a made-to-order request — and never a price. Every rupee is recomputed here
 * from the same pure functions the quote panel uses, so a tampered payload
 * cannot buy a chapter pack for one rupee and there is no second pricing rule to
 * keep in sync.
 *
 * Nothing is charged yet: today the request buys a free sample, and only the
 * team's work order prints the figures. Pricing stays on this side of the wire
 * regardless — it is the rule that has to be right on the day payment opens, not
 * something to wire up then.
 */

import { type Chapter, chapters, describeChapter, describeContents } from "@/lib/inventory";
import {
  ANSWER_KEY_OPTIONS,
  type AnswerKey,
  COPIES,
  type CustomRequest,
  DIFFICULTY_OPTIONS,
  type Difficulty,
  describeRequest,
  QUESTIONS,
  quoteFor,
} from "@/lib/quote";

/** Same shape the admin console accepts; deliberately stricter than the RFC. */
const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/** One order is one email; nobody needs more lines than this in a single send. */
export const MAX_ITEMS = 50;

export type CartItem =
  | { readonly kind: "chapter"; readonly chapterId: string }
  | { readonly kind: "custom"; readonly request: CustomRequest };

/** A cart entry plus the key React and the cart itself dedupe on. */
export type CartEntry = CartItem & { readonly key: string };

export type OrderLine = {
  readonly title: string;
  readonly meta: string;
  readonly price: number;
  /** Someone has to sit down and set this one before it can ship. */
  readonly madeToOrder: boolean;
};

export type OrderRequest = {
  readonly email: string;
  readonly items: readonly CartItem[];
};

export type ResolvedOrder = {
  readonly email: string;
  readonly lines: readonly OrderLine[];
  readonly total: number;
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

export function orderTotal(lines: readonly OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.price, 0);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim());
}

function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTY_OPTIONS.some((o) => o.value === value);
}

function isAnswerKey(value: unknown): value is AnswerKey {
  return ANSWER_KEY_OPTIONS.some((o) => o.value === value);
}

function parseCustomRequest(value: unknown): CustomRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;

  const chapter = typeof r.chapter === "string" ? r.chapter.trim().slice(0, 160) : "";
  const subject = typeof r.subject === "string" ? r.subject.trim().slice(0, 60) : "";
  if (!chapter || !subject) return null;
  if (r.board !== "CBSE" && r.board !== "ICSE") return null;
  if (r.cls !== "9" && r.cls !== "10") return null;
  if (!isDifficulty(r.difficulty) || !isAnswerKey(r.answerKey)) return null;
  if (typeof r.questions !== "number" || typeof r.copies !== "number") return null;
  if (!Number.isFinite(r.questions) || !Number.isFinite(r.copies)) return null;

  // Out-of-range numbers are clamped rather than rejected: `quoteFor` clamps
  // too, so rejecting here would only disagree with the price the panel showed.
  return {
    board: r.board,
    cls: r.cls,
    subject,
    chapter,
    questions: Math.min(QUESTIONS.max, Math.max(QUESTIONS.min, Math.round(r.questions))),
    copies: Math.min(COPIES.max, Math.max(COPIES.min, Math.round(r.copies))),
    difficulty: r.difficulty,
    answerKey: r.answerKey,
  };
}

export type ItemParse =
  | { readonly ok: true; readonly item: CartItem }
  | { readonly ok: false; readonly reason: string };

/**
 * Reads one untrusted cart item.
 *
 * Shared by the route handler and the cart's own restore-from-storage path:
 * `sessionStorage` is as much outside this program as a POST body is, and
 * whatever wrote it may have been an older build.
 */
export function parseCartItem(value: unknown): ItemParse {
  if (typeof value !== "object" || value === null) {
    return { ok: false, reason: "One of the items is not readable." };
  }
  const item = value as Record<string, unknown>;

  if (item.kind === "chapter") {
    if (typeof item.chapterId !== "string") {
      return { ok: false, reason: "One of the items is not readable." };
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

  return { ok: false, reason: "One of the items is not readable." };
}

/**
 * Turns an untrusted JSON body into a priced order, or says why it cannot.
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
    return { ok: false, reason: "The order has nothing in it." };
  }
  if (body.items.length > MAX_ITEMS) {
    return { ok: false, reason: `An order can hold at most ${MAX_ITEMS} items.` };
  }

  const lines: OrderLine[] = [];
  for (const raw of body.items) {
    const parsed = parseCartItem(raw);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };

    const line = resolveLine(parsed.item);
    if (!line) return { ok: false, reason: "That chapter is no longer in the inventory." };
    lines.push(line);
  }

  return { ok: true, email: body.email.trim(), lines, total: orderTotal(lines) };
}
