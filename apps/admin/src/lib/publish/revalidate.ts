import { configured, optional } from "@/lib/env";

export type RevalidateResult = { ok: boolean; detail: string };

const DEFAULT_FLEXIQ_URL = "https://flexiq.byteveda.org";

/**
 * Tells the public site that a post changed.
 *
 * Deliberately non-fatal. Publishing is a database write and has already
 * happened by the time this runs; a site that cannot be reached should surface
 * as "published, but the site has not picked it up yet" rather than as a failed
 * publish the operator is tempted to retry.
 */
export async function revalidateFlexiq(slug?: string): Promise<RevalidateResult> {
  if (!configured("REVALIDATE_SECRET")) {
    return { ok: false, detail: "REVALIDATE_SECRET is not set, so the site was not notified." };
  }

  const base = (optional("FLEXIQ_URL") ?? DEFAULT_FLEXIQ_URL).replace(/\/$/, "");
  const tags = slug ? ["blog", `blog:${slug}`] : ["blog"];

  try {
    const response = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.REVALIDATE_SECRET}`,
      },
      body: JSON.stringify({ tags }),
      cache: "no-store",
      // The operator is waiting on this; a hung site should not hold the page.
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { ok: false, detail: `The site answered ${response.status}.` };
    }
    return { ok: true, detail: "The site has picked it up." };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return { ok: false, detail: `Could not reach the site: ${reason}` };
  }
}
