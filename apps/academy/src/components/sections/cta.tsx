import Link from "next/link";

import { site } from "@/lib/site";

/**
 * The closing call, on the way out of every route.
 *
 * The hero opens with the question and the page spends itself answering it —
 * the shelf, the form, the terms. A reader who gets this far has run out of
 * page and has no button left in front of them, so the last band puts the same
 * two errands back within reach, phrased as the instruction rather than the
 * pitch.
 */
export function Cta() {
  return (
    <section className="cta reveal">
      <div className="wrap cta-inner">
        <p className="kicker">{site.name}</p>
        <h2 className="display cta-title">
          Then stop reading and start solving. One chapter, one sheet, in your inbox today.
        </h2>

        <div className="cta-actions">
          <Link className="btn btn-primary" href="/#inventory">
            Browse samples <span className="arr">→</span>
          </Link>
          <Link className="btn btn-ghost" href="/#custom">
            Send a requirement
          </Link>
        </div>
      </div>
    </section>
  );
}
