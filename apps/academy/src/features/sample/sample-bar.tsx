"use client";

import Link from "next/link";

import { useSamples } from "./store";

/**
 * Closes the inventory: what has been picked, and the way out of the page.
 *
 * This is where the running total used to sit, so it is also where the missing
 * checkout gets explained — the reader is looking here for the price when they
 * find out there isn't one to pay yet.
 */
export function SampleBar() {
  const { count } = useSamples();

  return (
    <>
      <div className="sample-bar">
        <div>
          <span className="label-xs">Your samples</span>
          <b className="num">
            {count === 0
              ? "Nothing picked yet"
              : `${count} ${count === 1 ? "chapter" : "chapters"} picked`}
          </b>
        </div>
        <Link className="btn btn-primary" href="/sample">
          Request samples <span className="arr">→</span>
        </Link>
      </div>

      <p className="soon">
        <span>
          Samples are free. Buying the full chapter packs is coming soon — the prices above are what
          they will cost.
        </span>
      </p>
    </>
  );
}
