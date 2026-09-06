import Image from "next/image";
import { site } from "@/lib/site";

/**
 * The FlexiQ brand lockup: the queue mark, then the name with the trailing Q
 * carrying the accent — matching how `docs.byteveda.org/flexiq` sets both. The
 * navbar and the footer render the same lockup, so it lives in one component
 * rather than being spelled out at each call site; otherwise a rename in
 * `site.name` silently breaks the colouring.
 *
 * The mark is decorative here — every call site wraps it in a link that already
 * carries an accessible name, so an alt would only repeat it.
 */
export function Wordmark() {
  const name = site.name;
  return (
    // One element, not a fragment: `.brand` is a flex row with a gap, so two
    // children would put that gap between the mark and the name.
    <span className="wordmark">
      <Image className="brand-logo" src="/logo.png" alt="" width={770} height={513} priority />
      <span>
        {name.slice(0, -1)}
        <span className="brand-q">{name.slice(-1)}</span>
      </span>
    </span>
  );
}
