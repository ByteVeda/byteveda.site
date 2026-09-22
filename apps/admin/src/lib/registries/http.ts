/**
 * Every registry gets the same treatment: identify ourselves, give up quickly,
 * and turn any failure into a value rather than an exception — one unreachable
 * registry must not abort a collection run across all the others.
 */
const USER_AGENT = "byteveda-admin (+https://byteveda.org)";
const TIMEOUT_MS = 15_000;

export type JsonResult<T> = { ok: true; body: T } | { ok: false; detail: string };

export async function getJson<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<JsonResult<T>> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT, ...headers },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 404) {
      return { ok: false, detail: "No such package upstream (404)." };
    }
    if (response.status === 429) {
      return { ok: false, detail: "Rate limited (429). Try again later." };
    }
    if (!response.ok) {
      return { ok: false, detail: `Upstream answered ${response.status}.` };
    }

    return { ok: true, body: (await response.json()) as T };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, detail: `Timed out after ${TIMEOUT_MS / 1000}s.` };
    }
    return { ok: false, detail: error instanceof Error ? error.message : "Unknown error." };
  }
}

/** `YYYY-MM-DD` in UTC, which is the grain every one of these APIs reports in. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgo(days: number, from = new Date()): string {
  return utcDay(new Date(from.getTime() - days * 86_400_000));
}
