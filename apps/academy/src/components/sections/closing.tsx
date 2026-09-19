/** One more door, for the reader who scrolled the whole way without deciding. */
export function Closing() {
  return (
    <section className="closing">
      <div className="wrap">
        <p className="kicker">byteveda academy</p>
        <h2 className="display">Want to test yourself?</h2>
        <p>
          Then stop reading and start solving. Pick a chapter, ask for the sample, print it today.
        </p>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <a className="btn btn-primary" href="#inventory">
            Browse the inventory <span className="arr">→</span>
          </a>
          <a className="btn btn-ghost" href="#custom">
            Send a requirement
          </a>
        </div>
      </div>
    </section>
  );
}
