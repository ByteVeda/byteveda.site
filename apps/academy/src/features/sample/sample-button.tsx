"use client";

import Link from "next/link";

import { useSamples } from "./store";

/** The nav's way to the request. Client-side for the count. */
export function SampleButton() {
  const { count } = useSamples();

  return (
    <Link className="btn btn-primary" href="/sample">
      Samples ({count})
    </Link>
  );
}
