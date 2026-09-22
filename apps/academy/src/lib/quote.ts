/**
 * Made-to-order pricing. The panel beside the request form re-quotes on every
 * keystroke, so this has to be a pure function of the form state — no clock,
 * no network, no rounding that depends on what was quoted a moment ago.
 *
 * A set chapter is the same chapter the shelf sells — the same mix, the same
 * free board and NCERT questions, the same optional advanced block. The only
 * thing a custom request adds is the setting: someone has to write and solve a
 * chapter nobody has asked for before. That is free, so a made-to-order
 * chapter now costs what the same chapter off the shelf costs — but it is
 * still quoted as its own line, because "we wrote this one for you and did not
 * charge for it" is worth saying rather than hiding in a total.
 */

import { MIX_LABEL, MIX_TOTAL, PRICING } from "@/features/pricing";
import type { Board, ClassLevel } from "./inventory";

export type CustomRequest = {
  board: Board;
  cls: ClassLevel;
  subject: string;
  /** Free text — the chapter or topic to set against. */
  chapter: string;
  /** The paid HOTS block on top of the standard mix. */
  advanced: boolean;
  copies: number;
};

export const COPIES = { min: 1, max: 60, default: 1 } as const;

export type AdvancedChoice = "no" | "yes";

export const ADVANCED_OPTIONS: readonly { value: AdvancedChoice; label: string }[] = [
  { value: "no", label: "Standard mix only" },
  { value: "yes", label: `Add advanced / HOTS (+₹${PRICING.advanced})` },
];

export type QuoteLine = {
  label: string;
  /** Already formatted — "₹149", "×12", "free". */
  value: string;
};

export type Quote = {
  /** What the sheet holds, before the free board and NCERT questions. */
  questions: number;
  copies: number;
  /** True once the class-set rate applies. */
  classSet: boolean;
  lines: readonly QuoteLine[];
  total: number;
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function quoteFor(request: CustomRequest): Quote {
  const copies = clamp(request.copies, COPIES.min, COPIES.max, COPIES.default);

  const advancedFee = request.advanced ? PRICING.advanced : 0;
  const perCopy = PRICING.chapter + advancedFee;
  const classSet = copies >= PRICING.classSetFrom;
  const copiesFee = Math.round(perCopy * copies * (classSet ? PRICING.classSetRate : 1));

  // The setting fee is labour on one chapter, not on one copy of it, so the
  // class-set rate never touches it — a school ordering forty copies is buying
  // forty prints of the same afternoon's work.
  const total = PRICING.setting + copiesFee;

  return {
    questions: MIX_TOTAL,
    copies,
    classSet,
    total,
    lines: [
      { label: `Chapter set · ${MIX_LABEL}`, value: `₹${PRICING.chapter}` },
      { label: "Board questions · NCERT exercise · answer key", value: "free" },
      {
        label: "Advanced / HOTS block",
        value: advancedFee ? `₹${advancedFee}` : "not added",
      },
      {
        label: "Written and solved for your chapter",
        value: PRICING.setting > 0 ? `₹${PRICING.setting}` : "free",
      },
      {
        label: `${copies} ${copies === 1 ? "copy" : "copies"}${classSet ? " · class-set rate −30%" : ""}`,
        value: copies === 1 ? "—" : `×${copies}`,
      },
    ],
  };
}

/** "CBSE · Class 10 · Mathematics · 50 questions · board and NCERT free · 12 copies" */
export function describeRequest(request: CustomRequest, quote: Quote): string {
  const parts = [
    request.board,
    `Class ${request.cls}`,
    request.subject,
    `${quote.questions} questions`,
    "board and NCERT free",
  ];
  if (request.advanced) parts.push("advanced block");
  if (quote.copies > 1) parts.push(`${quote.copies} copies`);
  return parts.join(" · ");
}
