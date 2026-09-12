"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Mark } from "@/components/mark";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * What the console shows when a page throws.
 *
 * Next's own production screen is the word ERROR and a number on a black
 * background. It is not wrong — a digest is all the browser is allowed to know,
 * since the message could carry a connection string or a row — but it reads as
 * a dead machine rather than a service with a problem, and it does not say that
 * the number is the thing to search the logs for.
 *
 * So: the same number, told as a fact, with the sentence that turns it into a
 * lookup, and the retry that a transient failure needs. Most failures here are
 * transient — the database is in another region behind a pooler with a ceiling,
 * and the page that failed is very often fine on the second attempt.
 */
export default function ConsoleError({ error, reset }: Props) {
  useEffect(() => {
    // The digest is the only handle the browser has on the server-side entry;
    // logging it here puts the two sides of the failure in the same place when
    // someone is looking at a console with devtools open.
    console.error("[console] render failed", error.digest ?? error.message, error);
  }, [error]);

  return (
    <main className="sheet">
      <div className="sheet-card fault-card">
        <span className="mark">
          <Mark />
        </span>

        <h1>This page did not load</h1>
        <p>
          Something failed on the server while rendering it. Nothing was lost — mail, posts and
          subscribers are all where they were.
        </p>

        {error.digest && (
          <p className="fault-digest">
            <span>Logged as</span>
            <code>{error.digest}</code>
          </p>
        )}

        <div className="fault-actions">
          <button type="button" className="abtn abtn-primary" onClick={reset}>
            <RotateCw aria-hidden />
            Try again
          </button>
          <Link className="abtn" href="/">
            Back to the dashboard
          </Link>
        </div>

        <p className="sheet-foot">
          If it keeps happening, that digest finds the stack trace in the deployment's runtime logs.
        </p>
      </div>
    </main>
  );
}
