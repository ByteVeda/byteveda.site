/**
 * The stocked catalogue. Every sheet here has been set against the NCERT or
 * ICSE chapter and solved end to end before it was listed.
 *
 * This is a static module on purpose: the catalogue changes when someone writes
 * a new worksheet, not when a request comes in. `listChapters` is the only read
 * path the UI uses, so swapping the source for a query later is a one-file job.
 *
 * Every chapter carries the same mix — see `features/pricing` — so the row only
 * records what varies: how many board questions and NCERT exercise questions
 * ride along free, and whether there is an advanced block to buy on top.
 */

import { MIX, MIX_TOTAL, PRICING } from "@/features/pricing";

export type Board = "CBSE" | "ICSE";
export type ClassLevel = "9" | "10";

/** The mix, plus the questions that come free with it. */
export type ChapterCounts = {
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
  /** Previous-year board questions. Zero in Class 9 — there is no paper yet. */
  readonly board: number;
  /** The NCERT back exercise, where the board sets one. Zero for ICSE. */
  readonly ncert: number;
};

export type Chapter = {
  /** Stable across reordering — the cart keys off it. */
  readonly id: string;
  readonly board: Board;
  readonly cls: ClassLevel;
  readonly subject: string;
  readonly title: string;
  readonly counts: ChapterCounts;
  /** Everything the chapter price buys: the mix and the free questions on top. */
  readonly questions: number;
  /** Size of the advanced block, or 0 where we do not set one for this chapter. */
  readonly advanced: number;
  /** False means we have not set it yet: it ships made-to-order, same price. */
  readonly inStock: boolean;
  readonly price: number;
  /** What the advanced block adds, or null where there is not one. */
  readonly advancedPrice: number | null;
};

/** `[board, class, subject, chapter, boardQs, ncertQs, advancedQs, inStock]` */
type Row = readonly [Board, ClassLevel, string, string, number, number, number, boolean];

const CATALOGUE: readonly Row[] = [
  ["CBSE", "10", "Science", "Chemical Reactions and Equations", 14, 20, 12, true],
  ["CBSE", "10", "Science", "Acids, Bases and Salts", 12, 18, 10, true],
  ["CBSE", "10", "Science", "Life Processes", 16, 16, 10, true],
  ["CBSE", "10", "Science", "Light — Reflection and Refraction", 18, 22, 14, true],
  ["CBSE", "10", "Science", "Electricity", 15, 18, 12, true],
  ["CBSE", "10", "Science", "Carbon and its Compounds", 13, 20, 10, false],
  ["CBSE", "10", "Mathematics", "Real Numbers", 10, 18, 8, true],
  ["CBSE", "10", "Mathematics", "Polynomials", 11, 14, 10, true],
  ["CBSE", "10", "Mathematics", "Quadratic Equations", 14, 24, 12, true],
  ["CBSE", "10", "Mathematics", "Triangles", 13, 26, 12, true],
  ["CBSE", "10", "Mathematics", "Introduction to Trigonometry", 16, 22, 14, true],
  ["CBSE", "10", "Mathematics", "Surface Areas and Volumes", 12, 20, 10, true],
  ["CBSE", "10", "Mathematics", "Statistics", 9, 16, 0, false],
  ["CBSE", "10", "Social Science", "Nationalism in India", 12, 10, 0, true],
  ["CBSE", "10", "Social Science", "Resources and Development", 9, 8, 0, true],
  ["CBSE", "10", "Social Science", "Federalism", 8, 7, 0, false],
  ["CBSE", "9", "Science", "Matter in Our Surroundings", 0, 16, 8, true],
  ["CBSE", "9", "Science", "The Fundamental Unit of Life", 0, 12, 8, true],
  ["CBSE", "9", "Science", "Motion", 0, 18, 10, true],
  ["CBSE", "9", "Science", "Force and Laws of Motion", 0, 16, 10, true],
  ["CBSE", "9", "Science", "Gravitation", 0, 14, 8, false],
  ["CBSE", "9", "Mathematics", "Number Systems", 0, 20, 10, true],
  ["CBSE", "9", "Mathematics", "Linear Equations in Two Variables", 0, 16, 8, true],
  ["CBSE", "9", "Mathematics", "Heron's Formula", 0, 12, 6, true],
  ["CBSE", "9", "Mathematics", "Circles", 0, 18, 8, false],
  ["CBSE", "9", "English", "Beehive — Prose and Poetry Set", 0, 14, 0, true],
  ["ICSE", "10", "Mathematics", "GST and Banking", 12, 0, 10, true],
  ["ICSE", "10", "Mathematics", "Quadratic Equations", 14, 0, 12, true],
  ["ICSE", "10", "Physics", "Force, Work, Power and Energy", 15, 0, 12, true],
  ["ICSE", "10", "Chemistry", "Acids, Bases and Salts", 12, 0, 10, true],
  ["ICSE", "10", "Biology", "Genetics — Some Basic Fundamentals", 10, 0, 8, false],
  ["ICSE", "10", "English", "Treasure Trove — Poems Set", 9, 0, 0, true],
  ["ICSE", "9", "Physics", "Motion in One Dimension", 0, 0, 10, true],
  ["ICSE", "9", "Chemistry", "The Language of Chemistry", 0, 0, 8, true],
  ["ICSE", "9", "Mathematics", "Compound Interest", 0, 0, 8, true],
  ["ICSE", "9", "Biology", "Plant and Animal Tissues", 0, 0, 0, false],
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const chapters: readonly Chapter[] = CATALOGUE.map(
  ([board, cls, subject, title, boardQs, ncertQs, advanced, inStock]) => ({
    id: `${board}-${cls}-${slugify(title)}`.toLowerCase(),
    board,
    cls,
    subject,
    title,
    counts: { ...MIX, board: boardQs, ncert: ncertQs },
    questions: MIX_TOTAL + boardQs + ncertQs,
    advanced,
    inStock,
    // Flat: one chapter, one price, stocked or set for you.
    price: PRICING.chapter,
    advancedPrice: advanced > 0 ? PRICING.advanced : null,
  }),
);

/** Subjects in catalogue order, so the filter row reads the way the table does. */
export const subjects: readonly string[] = [...new Set(chapters.map((c) => c.subject))];

export const stockedCount = chapters.filter((c) => c.inStock).length;

export type ChapterFilter = {
  board: Board | "All";
  cls: ClassLevel | "All";
  subject: string;
  query: string;
};

export const NO_FILTER: ChapterFilter = { board: "All", cls: "All", subject: "All", query: "" };

export function listChapters(filter: ChapterFilter): readonly Chapter[] {
  const query = filter.query.trim().toLowerCase();

  return chapters.filter(
    (c) =>
      (filter.board === "All" || c.board === filter.board) &&
      (filter.cls === "All" || c.cls === filter.cls) &&
      (filter.subject === "All" || c.subject === filter.subject) &&
      (!query || `${c.title} ${c.subject}`.toLowerCase().includes(query)),
  );
}

/**
 * What rides along at no charge — "14 board · 20 NCERT", or null where the
 * chapter has neither. Class 9 has no board paper to draw from, and ICSE has
 * no NCERT text, so "if present" is the rule rather than the exception.
 */
export function describeFree({ counts }: Chapter): string | null {
  const parts: string[] = [];
  if (counts.board > 0) parts.push(`${counts.board} board`);
  if (counts.ncert > 0) parts.push(`${counts.ncert} NCERT`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "50 Qs · 25/15/10 · +34 board and NCERT, free" */
export function describeContents(chapter: Chapter): string {
  const { easy, medium, hard } = chapter.counts;
  const free = describeFree(chapter);
  const mix = `${MIX_TOTAL} Qs · ${easy}/${medium}/${hard}`;
  return free ? `${mix} · +${free}, free` : mix;
}

/** "CBSE · Class 10 · Science" */
export function describeChapter({ board, cls, subject }: Chapter): string {
  return `${board} · Class ${cls} · ${subject}`;
}
