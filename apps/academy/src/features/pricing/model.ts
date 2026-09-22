/**
 * The price list.
 *
 * One file, because the shop has one set of numbers and four places that read
 * them — the inventory table, the made-to-order quote, the subject sets and the
 * hero. Nothing here imports anything: the catalogue is priced from these, not
 * the other way round.
 *
 * A chapter is a fixed mix sold flat. Board questions and the NCERT back
 * exercise ride along free wherever the chapter has them — those are the
 * questions a student is going to be set anyway, and charging for them is
 * charging for the textbook. Advanced is the one paid extension.
 */

/** What every chapter ships, whatever the subject. */
export const MIX = { easy: 25, medium: 15, hard: 10 } as const;

/** 50 — the mix, before the free questions that go on top of it. */
export const MIX_TOTAL = MIX.easy + MIX.medium + MIX.hard;

/** "25 easy · 15 medium · 10 hard" — the same sentence in every surface. */
export const MIX_LABEL = `${MIX.easy} easy · ${MIX.medium} medium · ${MIX.hard} hard`;

export const PRICING = {
  /** A chapter: the mix and its answer key. */
  chapter: 19,
  /** The HOTS block on top, where the chapter has one. */
  advanced: 20,
  /**
   * Setting a chapter we do not stock — writing it and solving it.
   *
   * Free. It was ₹149, charged once however many copies, and dropping it is
   * the offer: a made-to-order chapter now costs exactly what the same chapter
   * off the shelf costs, so "not in the inventory" stops being a surcharge and
   * becomes a thing we do. The number stays here rather than being deleted
   * along with the machinery around it — the fee is charged once per request
   * and never per copy, and that rule is worth keeping intact for the day it
   * is priced again.
   */
  setting: 0,
  /** Above this many copies the order is a class set and takes the rate below. */
  classSetFrom: 11,
  classSetRate: 0.7,
} as const;

export type SetTier = "subject" | "board" | "hots";

export type QuestionSet = {
  readonly tier: SetTier;
  readonly name: string;
  /** Per subject. A set is not sold by the chapter. */
  readonly price: number;
  /** Null on the subject set: it runs to as many questions as the subject has. */
  readonly questions: number | null;
  readonly summary: string;
};

/**
 * The sets, sold by the subject rather than the chapter.
 *
 * Revision is not chapter-shaped — nobody sits down the week before a paper to
 * revise one chapter — so the unit here is the subject, and the two paid sets
 * above the base one are the two things that week is actually spent on.
 */
export const SETS: readonly QuestionSet[] = [
  {
    tier: "subject",
    name: "Subject set",
    price: 199,
    questions: null,
    summary: "Every chapter we stock for the subject, in one set.",
  },
  {
    tier: "board",
    name: "Board set",
    price: 499,
    questions: 100,
    summary: "The questions the board keeps coming back to, pulled from the past papers.",
  },
  {
    tier: "hots",
    name: "HOTS set",
    price: 699,
    questions: 125,
    summary: "Application, case study, and the twists that separate a 90 from a 95.",
  },
];
