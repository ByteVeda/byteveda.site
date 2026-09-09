import { isStopword } from "./stopwords";
import { firstParagraph, headings, stripMarkup } from "./text";

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
