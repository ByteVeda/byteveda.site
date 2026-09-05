import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * The card that actually gets seen on LinkedIn, Reddit and X, where it competes
 * with everything else in a feed. It carries the page's claim rather than the
 * project's category — "a Rust task queue" describes a shelf, "delete Redis"
 * describes a change to the reader's afternoon.
 */
export default function OpengraphImage() {
  return ogImage({
    eyebrow: "Rust task queue · Python · Node · Java",
    title: "Delete Redis from your stack.",
    subtitle: "One process instead of three. Jobs, results and cron in a single SQLite file.",
  });
}
