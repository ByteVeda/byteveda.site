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
 *
 * `JSON.stringify` rather than stripping the offending characters, because it
 * escapes them instead of deleting them: a newline becomes a visible `\n` and
 * the value keeps its meaning, where a strip quietly rewrites the thing you are
 * trying to read. The quotes it adds are worth having too — they mark where an
 * untrusted value starts and ends. (It is also what CodeQL's log-injection
 * query recognises as a barrier; the only alternative it accepts is replacing
 * newlines with the empty string, which is the lossy option.)
 */

/** Long enough for a short stack, short enough that one value cannot flood a line. */
const MAX = 500;

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  // A stack is the useful part of a caught error, and escaping keeps it to one
  // line rather than the several it would otherwise span.
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  return String(value);
}

export function loggable(value: unknown, max = MAX): string {
  return JSON.stringify(textOf(value).slice(0, max));
}
