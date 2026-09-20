/**
 * The stocked catalogue. Every sheet here has been set against the NCERT or
 * ICSE chapter and solved end to end before it was listed.
 *
 * This is a static module on purpose: the catalogue changes when someone writes
 * a new worksheet, not when a request comes in. `listChapters` is the only read
 * path the UI uses, so swapping the source for a query later is a one-file job.
 */

export type Board = "CBSE" | "ICSE";
export type ClassLevel = "9" | "10";

export type Chapter = {
  /** Stable across reordering — the cart keys off it. */
  readonly id: string;
  readonly board: Board;
  readonly cls: ClassLevel;
  readonly subject: string;
  readonly title: string;
  readonly sheets: number;
  readonly questions: number;
  /** False means we have not set it yet: it ships made-to-order, at a premium. */
  readonly inStock: boolean;
  readonly price: number;
};

/** `[board, class, subject, chapter, sheets, questions, inStock]` */
type Row = readonly [Board, ClassLevel, string, string, number, number, boolean];

const CATALOGUE: readonly Row[] = [
  ["CBSE", "10", "Science", "Chemical Reactions and Equations", 3, 64, true],
  ["CBSE", "10", "Science", "Acids, Bases and Salts", 3, 58, true],
  ["CBSE", "10", "Science", "Life Processes", 2, 44, true],
  ["CBSE", "10", "Science", "Light — Reflection and Refraction", 4, 72, true],
  ["CBSE", "10", "Science", "Electricity", 3, 60, true],
  ["CBSE", "10", "Science", "Carbon and its Compounds", 2, 46, false],
  ["CBSE", "10", "Mathematics", "Real Numbers", 2, 40, true],
  ["CBSE", "10", "Mathematics", "Polynomials", 2, 42, true],
  ["CBSE", "10", "Mathematics", "Quadratic Equations", 3, 55, true],
  ["CBSE", "10", "Mathematics", "Triangles", 3, 50, true],
  ["CBSE", "10", "Mathematics", "Introduction to Trigonometry", 4, 68, true],
  ["CBSE", "10", "Mathematics", "Surface Areas and Volumes", 2, 38, true],
  ["CBSE", "10", "Mathematics", "Statistics", 2, 36, false],
  ["CBSE", "10", "Social Science", "Nationalism in India", 2, 34, true],
  ["CBSE", "10", "Social Science", "Resources and Development", 1, 22, true],
  ["CBSE", "10", "Social Science", "Federalism", 1, 20, false],
  ["CBSE", "9", "Science", "Matter in Our Surroundings", 2, 40, true],
  ["CBSE", "9", "Science", "The Fundamental Unit of Life", 2, 38, true],
  ["CBSE", "9", "Science", "Motion", 3, 54, true],
  ["CBSE", "9", "Science", "Force and Laws of Motion", 3, 52, true],
  ["CBSE", "9", "Science", "Gravitation", 2, 42, false],
  ["CBSE", "9", "Mathematics", "Number Systems", 2, 44, true],
  ["CBSE", "9", "Mathematics", "Linear Equations in Two Variables", 2, 36, true],
  ["CBSE", "9", "Mathematics", "Heron's Formula", 1, 20, true],
  ["CBSE", "9", "Mathematics", "Circles", 2, 34, false],
  ["CBSE", "9", "English", "Beehive — Prose and Poetry Set", 2, 30, true],
  ["ICSE", "10", "Mathematics", "GST and Banking", 2, 40, true],
  ["ICSE", "10", "Mathematics", "Quadratic Equations", 3, 56, true],
  ["ICSE", "10", "Physics", "Force, Work, Power and Energy", 3, 58, true],
  ["ICSE", "10", "Chemistry", "Acids, Bases and Salts", 2, 46, true],
  ["ICSE", "10", "Biology", "Genetics — Some Basic Fundamentals", 2, 40, false],
  ["ICSE", "10", "English", "Treasure Trove — Poems Set", 2, 28, true],
  ["ICSE", "9", "Physics", "Motion in One Dimension", 3, 52, true],
  ["ICSE", "9", "Chemistry", "The Language of Chemistry", 2, 38, true],
  ["ICSE", "9", "Mathematics", "Compound Interest", 2, 36, true],
  ["ICSE", "9", "Biology", "Plant and Animal Tissues", 1, 24, false],
];

/**
 * A single sheet is sold at the per-sheet rate; anything longer is a chapter
 * pack, which is cheaper than buying its sheets one by one. Made-to-order
 * chapters carry the setting fee on top.
 */
export const PRICING = {
  perSheet: 49,
  chapterPack: 129,
  /** Charged per sheet beyond the three a pack covers. */
  extraSheet: 30,
  /** A two-sheet chapter is a pack that is one sheet short. */
  twoSheetRebate: 20,
  madeToOrder: 70,
} as const;

export function priceOf({ sheets, inStock }: { sheets: number; inStock: boolean }): number {
  let price: number;
  if (sheets <= 1) price = PRICING.perSheet;
  else if (sheets === 2) price = PRICING.chapterPack - PRICING.twoSheetRebate;
  else price = PRICING.chapterPack + (sheets - 3) * PRICING.extraSheet;

  if (!inStock) price += PRICING.madeToOrder;

  return Math.max(PRICING.perSheet, Math.round(price));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const chapters: readonly Chapter[] = CATALOGUE.map(
  ([board, cls, subject, title, sheets, questions, inStock]) => ({
    id: `${board}-${cls}-${slugify(title)}`.toLowerCase(),
    board,
    cls,
    subject,
    title,
    sheets,
    questions,
    inStock,
    price: priceOf({ sheets, inStock }),
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

/** "3 sheets · 64 Qs" */
export function describeContents({ sheets, questions }: Chapter): string {
  return `${sheets} ${sheets === 1 ? "sheet" : "sheets"} · ${questions} Qs`;
}

/** "CBSE · Class 10 · Science" */
export function describeChapter({ board, cls, subject }: Chapter): string {
  return `${board} · Class ${cls} · ${subject}`;
}
