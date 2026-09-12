/**
 * Putting an untrusted value in a log line.
 *
 * Two things go wrong when a value someone else chose is interpolated straight
 * into `console.error`:
 *
 *   Forged entries. A value containing a newline ends the line and starts
 *   another, so whoever supplied it writes log entries of their own. Anything
 *   reading those logs — a person, or an alerting rule — is then reading
 *   attacker-authored text presented as ours.
 *
 *   Format specifiers. Node's console treats its first argument as a format
 *   string, so a value carrying `%s` or `%d` consumes the arguments after it and
 *   silently rewrites the message.
 *
 * This fixes the first. The second is fixed by the shape of the call: keep the
 * format string a literal and pass values as arguments, rather than building the
 * message with a template literal.
 *
 *   console.error("[inbound] could not fetch %s", loggable(emailId));
 */

/** Longer than any identifier worth logging, short enough not to flood a line. */
const MAX = 200;

export function loggable(value: unknown, max = MAX): string {
  const text = typeof value === "string" ? value : String(value);

  return (
    text
      // Explicitly, and first: a line break is the whole of the forged-entry
      // problem, and everything after it here is tidying.
      .replace(/\r/g, " ")
      .replace(/\n/g, " ")
      // The rest of what a terminal acts on rather than prints — an escape
      // introducer that repaints the line, a bell, a backspace. `Cc` is the
      // Unicode control category, which spares this file a literal one.
      .replace(/\p{Cc}/gu, " ")
      .slice(0, max)
  );
}
