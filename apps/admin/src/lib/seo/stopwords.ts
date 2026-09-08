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
