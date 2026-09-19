/**
 * Made-to-order pricing. The panel beside the request form re-quotes on every
 * keystroke, so this has to be a pure function of the form state — no clock,
 * no network, no rounding that depends on what was quoted a moment ago.
 */

import type { Board, ClassLevel } from "./inventory";

export type Difficulty = "practice" | "board" | "advanced";
export type AnswerKey = "steps" | "answers" | "none";

export type CustomRequest = {
  board: Board;
  cls: ClassLevel;
  subject: string;
  /** Free text — the chapter or topic to set against. */
  chapter: string;
  questions: number;
  difficulty: Difficulty;
  answerKey: AnswerKey;
  copies: number;
};

export const QUESTIONS = { min: 10, max: 120, step: 5, default: 30 } as const;
export const COPIES = { min: 1, max: 60, default: 1 } as const;

export const PRICING = {
  /** Setting and typesetting, charged once however long the sheet is. */
  setting: 149,
  /** Per block of ten questions, or part of one. */
  perTenQuestions: 22,
  difficulty: { practice: 0, board: 40, advanced: 80 },
  answerKey: { steps: 40, answers: 15, none: 0 },
  /** Above this many copies the order is a class set and takes the rate below. */
  classSetFrom: 11,
  classSetRate: 0.7,
} as const;

export const DIFFICULTY_OPTIONS: readonly { value: Difficulty; label: string }[] = [
  { value: "practice", label: "Practice — textbook level" },
  { value: "board", label: "Board-level mixed" },
  { value: "advanced", label: "Advanced / HOTS" },
];

export const ANSWER_KEY_OPTIONS: readonly { value: AnswerKey; label: string }[] = [
  { value: "steps", label: "Step-by-step solutions" },
  { value: "answers", label: "Final answers only" },
  { value: "none", label: "No key" },
];

const DIFFICULTY_SHORT: Record<Difficulty, string> = {
  practice: "practice",
  board: "board-level",
  advanced: "advanced",
};

export type QuoteLine = {
  label: string;
  /** Already formatted — "₹149", "×12", "included". */
  value: string;
};

export type Quote = {
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

function labelOf<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function quoteFor(request: CustomRequest): Quote {
  const questions = clamp(request.questions, QUESTIONS.min, QUESTIONS.max, QUESTIONS.default);
  const copies = clamp(request.copies, COPIES.min, COPIES.max, COPIES.default);

  const questionFee = Math.ceil(questions / 10) * PRICING.perTenQuestions;
  const difficultyFee = PRICING.difficulty[request.difficulty];
  const answerKeyFee = PRICING.answerKey[request.answerKey];

  const perCopy = PRICING.setting + questionFee + difficultyFee + answerKeyFee;
  const classSet = copies >= PRICING.classSetFrom;
  const gross = perCopy * copies;
  const total = Math.round(classSet ? gross * PRICING.classSetRate : gross);

  return {
    questions,
    copies,
    classSet,
    total,
    lines: [
      { label: "Set and typeset", value: `₹${PRICING.setting}` },
      { label: `${questions} questions`, value: `₹${questionFee}` },
      {
        label: labelOf(DIFFICULTY_OPTIONS, request.difficulty),
        value: difficultyFee ? `₹${difficultyFee}` : "included",
      },
      {
        label: labelOf(ANSWER_KEY_OPTIONS, request.answerKey),
        value: answerKeyFee ? `₹${answerKeyFee}` : "included",
      },
      {
        label: `${copies} ${copies === 1 ? "copy" : "copies"}${classSet ? " · class-set rate −30%" : ""}`,
        value: copies === 1 ? "—" : `×${copies}`,
      },
    ],
  };
}

/** "CBSE · Class 10 · Mathematics · 30 questions · board-level · 12 copies" */
export function describeRequest(request: CustomRequest, quote: Quote): string {
  const parts = [
    request.board,
    `Class ${request.cls}`,
    request.subject,
    `${quote.questions} questions`,
    DIFFICULTY_SHORT[request.difficulty],
  ];
  if (quote.copies > 1) parts.push(`${quote.copies} copies`);
  return parts.join(" · ");
}
