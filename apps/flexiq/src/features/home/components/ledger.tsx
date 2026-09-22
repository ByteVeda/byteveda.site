"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { LEDGER, type LedgerRow } from "@/content/pitch";

/**
 * The comparison, as an inventory rather than a feature table.
 *
 * A feature table invites the reader to score two products. This asks a
 * narrower and more useful question: what are you running right now, and what
 * would still be running afterwards? Every number is one the reader can check
 * against their own deployment, which is why there are four of them and not
 * fourteen.
 */
export function Ledger() {
  return (
    <section className="section-pad" id="ledger">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">The ledger</p>
          <h2>Four numbers, counted from your deployment.</h2>
          <p>
            Measured against a stock Celery install with a Redis broker, a result backend and a beat
            daemon — the arrangement most Python services are actually running. Nothing here is a
            benchmark; they are things you operate.
          </p>
        </div>

        <ul className="ledger">
          {LEDGER.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </ul>

        <p className="ledger-foot">
          The work does not go away — it moves into the Rust core and the file next to your app.
          What goes away is the part you page someone about at 3am.
        </p>
      </div>
    </section>
  );
}

function Row({ row }: { row: LedgerRow }) {
  return (
    <li className="ledger-row">
      <div className="ledger-nums">
        <span className="ledger-before">{row.before}</span>
        <span className="ledger-arrow" aria-hidden>
          →
        </span>
        <Tally to={row.after} />
      </div>
      <div className="ledger-text">
        <b>{row.label}</b>
        <span>{row.note}</span>
      </div>
    </li>
  );
}

/**
 * Counts to the final value once, when the row scrolls in. Reduced motion gets
 * the number immediately — the value is the content, the count is decoration.
 */
function Tally({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (reduced || !inView) return;
    const controls = animate(to + 3, to, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduced, to]);

  return (
    <span ref={ref} className="ledger-after">
      {value}
    </span>
  );
}
