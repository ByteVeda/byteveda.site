/**
 * Grouping inbound mail into conversations.
 *
 * Proper threading would follow `References` and `In-Reply-To`, but those are
 * absent often enough — a correspondent writing from a webmail client that
 * starts a fresh message — that the pragmatic key is the correspondent plus
 * the subject with its reply prefixes stripped.
 *
 * Everything here runs on strings an unauthenticated sender chose: anyone can
 * email the inbound address. That rules out patterns whose cost grows faster
 * than the input — a nested quantifier over optional whitespace is exactly the
 * shape that lets a crafted subject pin the webhook handler. The prefixes are
 * stripped one at a time with a bounded pattern, and the address is split with
 * plain string operations.
 */

/** Longer than any real subject; a header is capped at 998 octets by RFC 5322. */
const MAX_SUBJECT = 512;

/**
 * One reply prefix: `Re:`, `RE :`, `Fwd:`, `AW:`, `Re[2]:`.
 *
 * Anchored, and every repetition is bounded. Applied repeatedly by the caller
 * rather than wrapped in `(...)+`, which is what made the original quadratic.
 */
const REPLY_PREFIX = /^(re|fw|fwd|aw|sv|vs|antw)[ \t]{0,4}(\[\d{1,3}\])?[ \t]{0,4}:[ \t]{0,4}/i;

export function normaliseSubject(subject: string): string {
  let text = subject.slice(0, MAX_SUBJECT).trim();

  // Each pass removes exactly one prefix, so the work is linear in the number
  // of prefixes rather than exponential in the whitespace between them.
  for (;;) {
    const stripped = text.replace(REPLY_PREFIX, "");
    if (stripped === text) break;
    text = stripped.trimStart();
  }

  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * `Name <a@b.test>` and a bare address both reduce to the address.
 *
 * Deliberately not a regex: scanning for the last `<` is linear whatever the
 * input, where an unanchored `<([^>]+)>` retries from every position.
 */
export function normaliseEmail(address: string): string {
  const open = address.lastIndexOf("<");
  if (open !== -1) {
    const close = address.indexOf(">", open + 1);
    if (close !== -1)
      return address
        .slice(open + 1, close)
        .trim()
        .toLowerCase();
  }
  return address.trim().toLowerCase();
}

/** The display part of `"Ada Lovelace" <ada@example.test>`, or null. */
export function displayName(address: string): string | null {
  const open = address.lastIndexOf("<");
  if (open <= 0) return null;

  const name = address.slice(0, open).trim();
  // Strip one layer of surrounding quotes, which is all a display name carries.
  const unquoted =
    name.length > 1 && name.startsWith('"') && name.endsWith('"') ? name.slice(1, -1).trim() : name;

  return unquoted || null;
}

export function threadKeyFor(fromAddress: string, subject: string): string {
  const normalised = normaliseSubject(subject);
  // A subject that is only "Re:" leaves nothing; fall back so the whole
  // correspondence groups together rather than each message standing alone.
  return `${normaliseEmail(fromAddress)}::${normalised || "(no subject)"}`;
}
