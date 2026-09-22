import { BrandMark } from "@byteveda/ui";
import Link from "next/link";

import { site } from "@/lib/site";

/**
 * The academy lockup: the leaf on its favicon tile, the org set in the page's
 * own ink, the surface set in the accent.
 *
 * The shared `Wordmark` pairs the mark with a lowercase word — it reads as
 * ByteVeda's, and on this site the second word ("academy.") was doing the
 * naming on its own. A parent landing here at 9pm has never heard of us, so
 * the header spells the whole name out instead.
 */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    // `brand` as well as `brand-text`: the shared class is what the mobile
    // audit's 44px tap-target rule is keyed on.
    <Link href={href} className="brand brand-text" aria-label={`${site.name} home`}>
      <span className="brand-tile">
        <BrandMark height={20} />
      </span>
      <span>
        ByteVeda <span className="brand-surface">Academy</span>
      </span>
    </Link>
  );
}
