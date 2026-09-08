/**
 * Grouping inbound mail into conversations.
 *
 * Proper threading would follow `References` and `In-Reply-To`, but those are
 * absent often enough — a correspondent writing from a webmail client that
 * starts a fresh message — that the pragmatic key is the correspondent plus
 * the subject with its reply prefixes stripped.
 */

/** `Re:`, `RE :`, `Fwd:`, `AW:`, `SV:`, and stacks of them. */
const REPLY_PREFIX = /^\s*((re|fw|fwd|aw|sv|vs|antw)\s*(\[\d+\])?\s*:\s*)+/i;

export function normaliseSubject(subject: string): string {
  return subject.replace(REPLY_PREFIX, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normaliseEmail(address: string): string {
  // `Name <a@b.test>` and a bare address both reduce to the address, lowercased.
  const angled = /<([^>]+)>/.exec(address);
  return (angled ? angled[1] : address).trim().toLowerCase();
}

export function displayName(address: string): string | null {
  const named = /^\s*"?([^"<]+?)"?\s*</.exec(address);
  const name = named?.[1]?.trim();
  return name ? name : null;
}

export function threadKeyFor(fromAddress: string, subject: string): string {
  const normalised = normaliseSubject(subject);
  // A subject that is only "Re:" leaves nothing; fall back so the whole
  // correspondence groups together rather than each message standing alone.
  return `${normaliseEmail(fromAddress)}::${normalised || "(no subject)"}`;
}
