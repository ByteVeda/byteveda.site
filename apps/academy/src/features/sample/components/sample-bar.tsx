"use client";

import Link from "next/link";

import { useSamples } from "./store";

/**
 * Closes the inventory: what is picked, and the way out of the page.
 *
 * This is where the running total used to sit, so it is also where the missing
 * checkout gets explained — the reader is looking here for the price when they
 * find out there isn't one to pay yet.
 */
export function SampleBar() {
  const { line } = useSamples();

  return (
    <>
      <div className="sample-bar">
        <div>
          <span className="label-xs">Your free sample</span>
          <b className="num">{line ? line.title : "Nothing picked yet"}</b>
        </div>
        <Link className="btn btn-primary" href="/sample">
          Request sample <span className="arr">→</span>
        </Link>
      </div>

      <p className="soon">
        <span>
          One free sample per email address — picking another chapter swaps it. Buying the full
          chapters is coming soon; the prices above are what they will cost.
        </span>
      </p>
    </>
  );
}
