/**
 * What a search engine would make of a draft, worked out from the draft alone.
 *
 * The panel beside the editor re-scores a post as it is typed, so every rule
 * here has to answer from the text in front of it and answer fast enough to run
 * on a keystroke. Nothing reads the database and nothing calls out to a search
 * engine: the corpus the keyword ranking needs is handed in by the page that
 * already loaded it.
 *
 * Client-safe on purpose — the scoring runs in the browser, which is the only
 * place a draft exists before it is saved.
 */

/**
 * Turning MDX into something countable.
 *
 * Everything here is deliberately lexical. Parsing the MDX properly would mean
 * carrying a full pipeline into the editor's keystroke path for an answer that
 * only has to be approximately right.
 */

/** Fenced code, inline code, JSX, and comments are not prose and must not be counted. */
export function stripMarkup(source: string): string {
  return (
    source
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/~~~[\s\S]*?~~~/g, " ")
      .replace(/`[^`\n]*`/g, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // JSX and HTML elements, keeping whatever sat between the tags.
      .replace(/<\/?[A-Za-z][^>]*>/g, " ")
      // Images before links, so alt text does not survive as link text.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s{0,3}([*+-]|\d+\.)\s+/gm, "")
      .replace(/[*_~]{1,3}/g, "")
      .replace(/^\s*\|.*\|\s*$/gm, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export type Heading = { level: number; text: string };

export function headings(source: string): Heading[] {
  const found: Heading[] = [];
  const withoutCode = source.replace(/```[\s\S]*?```/g, "");

  for (const match of withoutCode.matchAll(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/gm)) {
    found.push({ level: match[1].length, text: stripMarkup(match[2]) });
  }
  return found;
}

/** Every link target in the body, in source order. */
export function links(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) {
    found.push(match[1]);
  }
  return found;
}

export function isInternalLink(href: string): boolean {
  if (href.startsWith("#")) return false;
  if (href.startsWith("/")) return true;

  // The trailing `(\/|\?|#|$)` is load-bearing. Without it the pattern matches
  // any host that merely starts with ours — `byteveda.org.example.com` would
  // count as an internal link.
  return /^https?:\/\/([a-z0-9-]+\.)*byteveda\.org(\/|\?|#|$)/i.test(href);
}

/** The first real paragraph — what a search engine shows and a reader reads. */
export function firstParagraph(source: string): string {
  const body = source
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();

  for (const block of body.split(/\n\s*\n/)) {
    const text = stripMarkup(block);
    // Skip a leading heading, and anything that reduced to punctuation.
    if (text.length > 40) return text;
  }
  return "";
}

export function wordCount(source: string): number {
  const text = stripMarkup(source);
  return text ? text.split(/\s+/).length : 0;
}

/**
 * Words that carry no topic.
 *
 * They also act as phrase boundaries when building n-grams, which is what stops
 * "queue with a broker" being offered as a keyword.
 */
// biome-ignore format: a packed grid is readable; one word per line is 250 lines of noise
export const STOPWORDS = new Set([
  "a", "about", "above", "across", "after", "again", "against", "all", "almost", "also",
  "although", "always", "am", "among", "an", "and", "another", "any", "anything", "are",
  "around", "as", "at", "back", "be", "because", "been", "before", "behind", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "do", "does",
  "doing", "done", "down", "during", "each", "either", "else", "enough", "even", "ever",
  "every", "few", "for", "from", "further", "get", "gets", "give", "go", "goes", "got",
  "had", "has", "have", "having", "he", "her", "here", "hers", "him", "his", "how",
  "however", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "keep", "let",
  "like", "make", "makes", "many", "may", "me", "might", "more", "most", "much", "must",
  "my", "need", "needs", "never", "next", "no", "nor", "not", "now", "of", "off", "often",
  "on", "once", "one", "only", "onto", "or", "other", "others", "our", "out", "over",
  "own", "per", "put", "rather", "really", "same", "see", "several", "shall", "she",
  "should", "since", "so", "some", "something", "still", "such", "take", "than", "that",
  "the", "their", "them", "then", "there", "therefore", "these", "they", "thing", "things",
  "this", "those", "though", "through", "thus", "to", "too", "two", "under", "until", "up",
  "upon", "us", "use", "used", "uses", "using", "very", "via", "want", "was", "way", "we",
  "well", "were", "what", "when", "where", "whether", "which", "while", "who", "whom",
  "why", "will", "with", "within", "without", "would", "yet", "you", "your", "yours",
]);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word);
}

export type KeywordCandidate = {
  term: string;
  /** Words in the phrase. */
  size: number;
  occurrences: number;
  score: number;
  /** Where the term already appears, which is what makes a suggestion actionable. */
  inTitle: boolean;
  inHeading: boolean;
  inOpening: boolean;
};

export type KeywordInput = {
  title: string;
  body: string;
  /** Other posts' bodies. A term common to all of them says nothing about this one. */
  corpus?: string[];
};

const MAX_PHRASE = 3;
/** Weights for where a term shows up. Multiplicative, so they compound. */
const TITLE_BOOST = 2.6;
const HEADING_BOOST = 1.6;
const OPENING_BOOST = 1.25;

/**
 * Words, lowercased, with stopwords and punctuation replaced by a break.
 *
 * The breaks matter more than the words: phrases are built inside runs, so a
 * gap prevents "retries and the queue" from becoming a candidate phrase.
 */
export function toRuns(text: string): string[][] {
  const runs: string[][] = [];
  let run: string[] = [];

  for (const raw of text.toLowerCase().split(/[^a-z0-9'-]+/)) {
    // Keep internal hyphens ("dead-letter"), drop leading and trailing ones.
    const word = raw.replace(/^[-']+|[-']+$/g, "");
    const usable = word.length > 1 && !isStopword(word) && !/^\d+$/.test(word);

    if (usable) {
      run.push(word);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/** Every 1..3-word phrase that sits inside a single run. */
export function phrases(runs: string[][], max = MAX_PHRASE): string[] {
  const out: string[] = [];
  for (const run of runs) {
    for (let size = 1; size <= max; size += 1) {
      for (let start = 0; start + size <= run.length; start += 1) {
        out.push(run.slice(start, start + size).join(" "));
      }
    }
  }
  return out;
}

function counted(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const phrase of phrases(toRuns(text))) {
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return counts;
}

/**
 * Inverse document frequency over the other posts.
 *
 * With no corpus every term gets the same neutral weight, so a first post still
 * produces a sensible ranking — just one driven purely by frequency and placement.
 */
function idfOver(corpus: string[]): (term: string) => number {
  if (corpus.length === 0) return () => 1;

  const documentFrequency = new Map<string, number>();
  for (const document of corpus) {
    for (const term of new Set(counted(document).keys())) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = corpus.length;
  return (term) => Math.log(1 + total / (1 + (documentFrequency.get(term) ?? 0)));
}

/**
 * Ranked keyword candidates for a draft.
 *
 * Frequency says what the post talks about; the corpus says whether that is
 * distinctive; placement says whether the author already treats it as the
 * subject. A term wins by doing well on all three.
 */
export function extractKeywords(input: KeywordInput, limit = 12): KeywordCandidate[] {
  const prose = stripMarkup(input.body);
  if (!prose && !input.title.trim()) return [];

  const counts = counted(prose);
  const idf = idfOver(input.corpus ?? []);

  const titleTerms = new Set(phrases(toRuns(input.title)));
  const headingTerms = new Set(
    phrases(
      toRuns(
        headings(input.body)
          .map((heading) => heading.text)
          .join(". "),
      ),
    ),
  );
  const openingTerms = new Set(phrases(toRuns(firstParagraph(input.body))));

  const longest = Math.max(1, ...counts.values());
  const candidates: KeywordCandidate[] = [];

  for (const [term, occurrences] of counts) {
    const size = term.split(" ").length;
    // A phrase seen once is a coincidence; a single word seen once is noise.
    if (size === 1 && occurrences < 2) continue;
    if (size > 1 && occurrences < 2 && !titleTerms.has(term)) continue;

    const inTitle = titleTerms.has(term);
    const inHeading = headingTerms.has(term);
    const inOpening = openingTerms.has(term);

    const termFrequency = occurrences / longest;
    // Multi-word phrases are more useful as search targets than bare nouns.
    const lengthBonus = 1 + (size - 1) * 0.35;
    const score =
      termFrequency *
      idf(term) *
      lengthBonus *
      (inTitle ? TITLE_BOOST : 1) *
      (inHeading ? HEADING_BOOST : 1) *
      (inOpening ? OPENING_BOOST : 1);

    candidates.push({ term, size, occurrences, score, inTitle, inHeading, inOpening });
  }

  return candidates
    .sort(
      (a, b) => b.score - a.score || b.occurrences - a.occurrences || a.term.localeCompare(b.term),
    )
    .filter(subsumedByABetterPhrase(limit))
    .slice(0, limit);
}

/**
 * Drops a single word when a higher-ranked phrase already contains it — "queue"
 * adds nothing next to "task queue" that is already above it in the list.
 */
function subsumedByABetterPhrase(limit: number) {
  const kept: string[] = [];
  return (candidate: KeywordCandidate): boolean => {
    if (kept.length >= limit) return false;
    if (candidate.size === 1 && kept.some((term) => term.split(" ").includes(candidate.term))) {
      return false;
    }
    kept.push(candidate.term);
    return true;
  };
}

export type CheckStatus = "pass" | "warn" | "fail";

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  /** What is true right now, and what to do about it. Never just "bad". */
  detail: string;
};

export type AuditInput = {
  title: string;
  description: string;
  slug: string;
  body: string;
  tags: string[];
  /** The term the post is meant to rank for, if one has been chosen. */
  primaryKeyword?: string;
};

/** Google truncates a title around 60 characters and rarely shows fewer than 30. */
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 158;
const SLUG_MAX = 60;
const THIN_CONTENT = 300;

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function titleCheck({ title }: AuditInput): Check {
  const length = title.trim().length;
  if (length === 0) {
    return { id: "title", label: "Title", status: "fail", detail: "Give the post a title." };
  }
  if (length < TITLE_MIN) {
    return {
      id: "title",
      label: "Title",
      status: "warn",
      detail: `${length} characters. Aim for ${TITLE_MIN}–${TITLE_MAX} so the result is not sparse.`,
    };
  }
  if (length > TITLE_MAX) {
    return {
      id: "title",
      label: "Title",
      status: "warn",
      detail: `${length} characters. Search results cut off around ${TITLE_MAX}.`,
    };
  }
  return { id: "title", label: "Title", status: "pass", detail: `${length} characters.` };
}

function descriptionCheck({ description }: AuditInput): Check {
  const length = description.trim().length;
  if (length === 0) {
    return {
      id: "description",
      label: "Meta description",
      status: "fail",
      detail: "Write one. Without it, search engines invent a snippet from the body.",
    };
  }
  if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) {
    return {
      id: "description",
      label: "Meta description",
      status: "warn",
      detail: `${length} characters. ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} is what fits.`,
    };
  }
  return {
    id: "description",
    label: "Meta description",
    status: "pass",
    detail: `${length} characters.`,
  };
}

function slugCheck({ slug }: AuditInput): Check {
  if (!slug) {
    return { id: "slug", label: "Slug", status: "fail", detail: "Set a slug before publishing." };
  }
  if (!SLUG_SHAPE.test(slug)) {
    return {
      id: "slug",
      label: "Slug",
      status: "fail",
      detail: "Use lowercase words separated by single hyphens.",
    };
  }
  if (slug.length > SLUG_MAX) {
    return {
      id: "slug",
      label: "Slug",
      status: "warn",
      detail: `${slug.length} characters. Shorter URLs travel better.`,
    };
  }
  return { id: "slug", label: "Slug", status: "pass", detail: `/blog/${slug}` };
}

function keywordCheck(input: AuditInput): Check[] {
  const keyword = input.primaryKeyword?.trim();
  if (!keyword) {
    return [
      {
        id: "keyword",
        label: "Primary keyword",
        status: "warn",
        detail: "Pick one from the suggestions to check the title and opening against it.",
      },
    ];
  }

  const opening = input.body.slice(0, 1200);
  return [
    {
      id: "keyword-title",
      label: "Keyword in title",
      status: contains(input.title, keyword) ? "pass" : "warn",
      detail: contains(input.title, keyword)
        ? `"${keyword}" is in the title.`
        : `Work "${keyword}" into the title if it fits naturally.`,
    },
    {
      id: "keyword-opening",
      label: "Keyword in opening",
      status: contains(opening, keyword) ? "pass" : "warn",
      detail: contains(opening, keyword)
        ? `"${keyword}" appears early.`
        : `Mention "${keyword}" in the first paragraph or two.`,
    },
  ];
}

function headingCheck({ body }: AuditInput): Check {
  const found = headings(body);
  if (found.length === 0) {
    return {
      id: "headings",
      label: "Headings",
      status: "warn",
      detail: "No headings. Long posts are much easier to scan with them.",
    };
  }

  // The page renders the title as the h1, so the body should start at h2.
  const topLevel = Math.min(...found.map((heading) => heading.level));
  if (topLevel < 2) {
    return {
      id: "headings",
      label: "Headings",
      status: "warn",
      detail: "The page title is already the h1. Start the body at h2.",
    };
  }

  let previous = topLevel;
  for (const heading of found) {
    if (heading.level > previous + 1) {
      return {
        id: "headings",
        label: "Headings",
        status: "warn",
        detail: `"${heading.text}" jumps from h${previous} to h${heading.level}.`,
      };
    }
    previous = heading.level;
  }

  return {
    id: "headings",
    label: "Headings",
    status: "pass",
    detail: `${found.length} heading${found.length === 1 ? "" : "s"}, properly nested.`,
  };
}

function linkCheck({ body }: AuditInput): Check {
  const internal = links(body).filter(isInternalLink).length;
  if (internal === 0) {
    return {
      id: "links",
      label: "Internal links",
      status: "warn",
      detail: "None. Link to a related post or a docs page.",
    };
  }
  return {
    id: "links",
    label: "Internal links",
    status: "pass",
    detail: `${internal} link${internal === 1 ? "" : "s"} to your own pages.`,
  };
}

function lengthCheck({ body }: AuditInput): Check {
  const words = wordCount(body);
  if (words === 0) {
    return { id: "length", label: "Length", status: "fail", detail: "The post is empty." };
  }
  if (words < THIN_CONTENT) {
    return {
      id: "length",
      label: "Length",
      status: "warn",
      detail: `${words} words. Under ${THIN_CONTENT} tends to read as a stub.`,
    };
  }
  return { id: "length", label: "Length", status: "pass", detail: `${words} words.` };
}

function tagCheck({ tags }: AuditInput): Check {
  if (tags.length === 0) {
    return {
      id: "tags",
      label: "Tags",
      status: "warn",
      detail: "Add one or two so the post groups with related writing.",
    };
  }
  return { id: "tags", label: "Tags", status: "pass", detail: tags.join(", ") };
}

/** Everything the panel shows, in the order it shows it. */
export function auditPost(input: AuditInput): Check[] {
  return [
    titleCheck(input),
    descriptionCheck(input),
    slugCheck(input),
    ...keywordCheck(input),
    headingCheck(input),
    linkCheck(input),
    lengthCheck(input),
    tagCheck(input),
  ];
}

/** A single number for the header. Warnings cost half of what failures cost. */
export function auditScore(checks: Check[]): number {
  if (checks.length === 0) return 0;
  const earned = checks.reduce((total, check) => {
    if (check.status === "pass") return total + 1;
    return check.status === "warn" ? total + 0.5 : total;
  }, 0);
  return Math.round((earned / checks.length) * 100);
}
