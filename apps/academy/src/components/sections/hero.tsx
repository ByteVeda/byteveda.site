import { MIX_LABEL, PRICING } from "@/lib/pricing";
import { TURNAROUND } from "@/lib/site";

const TRACE = [
  { term: "you type", detail: "“Chemical Reactions and Equations”" },
  { term: "inventory", detail: `₹${PRICING.chapter} · ${MIX_LABEL} · in stock`, hit: true },
  { term: "free with it", detail: "14 board questions · 20 NCERT · answer key" },
  { term: "inbox", detail: "under 24 hours — print and start" },
];

/**
 * The whole transaction, above the fold.
 *
 * Nobody arrives here wanting to read about pedagogy; they arrive with a
 * chapter name and a test on Friday. So the panel on the right is the errand
 * itself, traced out before they have typed anything.
 */
export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="wrap hero-inner">
        <div>
          <p className="kicker">Chapter-wise assignments</p>
          <h1 className="display">Want to test yourself?</h1>
          <p className="lede">
            Pick a chapter, get the sheet — ₹{PRICING.chapter} for {MIX_LABEL}, with the board
            questions and the NCERT exercise thrown in free. CBSE and ICSE, Class 9 and 10, stocked
            or set to your requirement. Ask for a free sample and it lands in your inbox within{" "}
            {TURNAROUND}.
          </p>

          <div className="hero-actions">
            <a className="btn btn-primary" href="#inventory">
              Browse the inventory <span className="arr">→</span>
            </a>
            <a className="btn btn-ghost" href="#custom">
              Request a custom assignment
            </a>
          </div>

          <div className="hero-stats">
            <div>
              {/* <b className="num">{stockedCount}</b> */}
              <b className="num">{51}</b>
              <span>chapters in stock</span>
            </div>
            <div>
              <b className="num">24h</b>
              <span>emailed, worst case</span>
            </div>
            <div>
              <b className="num">₹{PRICING.chapter}</b>
              <span>per chapter</span>
            </div>
          </div>
        </div>

        <div className="trace reveal">
          <div className="trace-head">
            <div className="trace-dots" aria-hidden>
              <i />
              <i />
              <i />
            </div>
            <span>sample trace · class 10 · cbse</span>
          </div>

          <dl>
            {TRACE.map((row) => (
              <div className="trace-row" key={row.term}>
                <dt>{row.term}</dt>
                <dd className={row.hit ? "hit" : undefined}>{row.detail}</dd>
              </div>
            ))}
          </dl>

          <p className="trace-foot">
            » no subscription · no login · see a sheet before you pay for one
          </p>
        </div>
      </div>
    </section>
  );
}
