import { EngineDiagram } from "./engine-diagram";

const steps = [
  {
    k: "01",
    title: "Measure first",
    body: "Profile the real bottleneck before a line of the core is written.",
  },
  {
    k: "02",
    title: "Fit the foundation",
    body: "Rust, C++, Go, or pure Python — chosen per problem, never by habit.",
  },
  {
    k: "03",
    title: "Hold the bar",
    body: "Benchmarked, documented, permissively licensed. Every tool, every release.",
  },
];

export function Approach() {
  return (
    <section className="section-pad" id="approach" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="marker">The approach</span>
          <h2>No house style. One standard.</h2>
        </div>
        <div className="engine reveal">
          <div className="engine-grid">
            <div className="engine-copy">
              <h3>Right foundation for each problem.</h3>
              <p>
                Some problems want a Rust core. Others want C++ throughput, Go's concurrency, or
                plain, readable Python. We don't force one architecture on every tool — we pick what
                the problem needs, then hold every build to the same bar.
              </p>
              <div className="engine-steps">
                {steps.map((s) => (
                  <div className="engine-step" key={s.k}>
                    <span className="k">{s.k}</span>
                    <div>
                      <b>{s.title}</b>
                      <span>{s.body}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="engine-stage">
              <div className="diag-grid" aria-hidden />
              <EngineDiagram />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
