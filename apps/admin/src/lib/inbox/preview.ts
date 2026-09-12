/**
 * The one line of a message that the conversation list shows.
 *
 * Denormalised onto `email_threads` rather than derived per render, so the list
 * is a single index scan instead of a lateral join into two message tables for
 * every row it returns.
 *
 * Everything here runs on a string an unauthenticated sender chose: anyone can
 * email the inbound address. That rules out any pattern whose cost grows faster
 * than the input, which is what the length cap below is really for — see
 * `lib/email/thread.ts` for the same reasoning applied to subjects.
 */

/** Characters kept. Two clamped lines in the list, with room for a wide one. */
const PREVIEW_LENGTH = 200;

/**
 * How much HTML is examined to find those characters.
 *
 * A bound, not an estimate. The tag strip below is linear in what it is given,
 * and a mail body has no size limit worth trusting — 4 KB is far more than the
 * opening sentence and turns an unbounded scan into a fixed one.
 */
const HTML_BUDGET = 4096;

/** The entities that actually turn up in the first line of a message. */
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Readable text out of mail HTML.
 *
 * Not a parser and not trying to be one: the result is rendered as text, so the
 * only job is to keep a preview from being a run of tag names. `<script>` and
 * `<style>` go first because their *contents* are not markup, and a preview
 * that opens with a CSS reset is worse than no preview.
 */
function textFromHtml(html: string): string {
  const bounded = html.slice(0, HTML_BUDGET);

  const stripped = bounded
    // Both quantifiers are bounded by the slice above, so the worst case is a
    // fixed multiple of HTML_BUDGET rather than a function of the message.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  return stripped.replace(/&[a-z#0-9]{2,6};/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ");
}

/**
 * A message reduced to one line.
 *
 * Plain text wins when there is any: it is what the sender wrote, where the
 * HTML is what their client made of it. A message with neither gives an empty
 * string, and the list falls back to showing only the subject.
 */
export function previewOf(text: string, html?: string | null): string {
  const source = text.trim() || textFromHtml(html ?? "");

  return source.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH);
}
