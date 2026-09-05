import { site } from "@/lib/site";

/**
 * The FlexiQ wordmark: the trailing Q carries the accent, matching how
 * `docs.byteveda.org/flexiq` sets it. Both surfaces render the same name, so
 * the split lives in one component rather than being spelled out at each call
 * site — otherwise a rename in `site.name` silently breaks the colouring.
 */
export function Wordmark() {
  const name = site.name;
  return (
    // One element, not a fragment: `.brand` is a flex row with a gap, so two
    // children would put that gap between "Flexi" and its "Q".
    <span className="wordmark">
      {name.slice(0, -1)}
      <span className="brand-q">{name.slice(-1)}</span>
    </span>
  );
}
