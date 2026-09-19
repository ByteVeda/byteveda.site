const PROMISES = [
  {
    index: "01",
    title: "Stocked, not generated on the spot",
    body: "Every sheet in the inventory has been set against the NCERT or ICSE chapter, solved end to end, and checked once more before it ships.",
  },
  {
    index: "02",
    title: "Not in stock? We set it",
    body: "Send the chapter, the question count and the difficulty you want. Made-to-order assignments come back within the same 24-hour window.",
  },
  {
    index: "03",
    title: "See it before you buy it",
    body: "Ask for a free sample of any chapter and judge the sheet yourself. Buying — per worksheet, by the chapter pack, or a class set for a tuition centre — is coming soon; no plan, no lock-in when it lands.",
  },
];

/** The three objections, answered before the inventory asks for a decision. */
export function Promises() {
  return (
    <section className="cells reveal">
      {PROMISES.map((promise) => (
        <div className="cell" key={promise.index}>
          <p className="cell-index">{promise.index}</p>
          <h3>{promise.title}</h3>
          <p>{promise.body}</p>
        </div>
      ))}
    </section>
  );
}
