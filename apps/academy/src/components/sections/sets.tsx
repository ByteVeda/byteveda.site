import { SETS } from "@/features/pricing";

/**
 * The three subject sets, drawn as cards.
 *
 * A card is the shape the thing itself has — a set is a stack of questions, so
 * the page draws a stack rather than another table row. Three of them side by
 * side is the whole comparison: what is in it, and what it costs.
 *
 * No state and no pick. The sets are priced per subject, which makes the
 * subject a line on the card rather than a control, and buying is not open yet
 * for these any more than it is for a chapter.
 */
export function Sets() {
  return (
    <section className="sets wrap" id="sets">
      <div className="inventory-head">
        <div>
          <p className="kicker">Subject sets</p>
          <h2 className="display">Or take the whole subject.</h2>
        </div>
        <p className="sets-note">Priced per subject · answer keys included</p>
      </div>

      <div className="set-grid">
        {SETS.map((set) => (
          <article className="set-card" key={set.tier}>
            <p className="set-name">{set.name}</p>

            <p className="set-size">
              {set.questions === null ? "Every chapter" : `${set.questions} questions`}
            </p>
            <p className="set-unit">per subject</p>

            <p className="set-body">{set.summary}</p>

            <b className="num set-price">₹{set.price}</b>
          </article>
        ))}
      </div>

      <p className="soon">
        <span>
          Sets cover Class 9 and 10 for the subject as we stock it. Buying opens with the chapters —
          ask for a free chapter sample today and we will mail you when it does.
        </span>
      </p>
    </section>
  );
}
