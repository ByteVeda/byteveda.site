import { HeroNet } from "@/components/fx";
import { Button } from "@/components/ui";
import { site } from "@/lib/site";

/** A static benchmark terminal — reclink dedupe, 68× faster on the byteveda core. */
function BenchmarkTerminal() {
  return (
    <div className="term">
      <div className="term-bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="name">benchmark · reclink</span>
      </div>
      <div className="term-body">
        <div className="line">
          <span className="out"># baseline implementation</span>
        </div>
        <div className="line">
          <span className="cmd">dedupe(records)</span> <span className="out">→ 4.81s</span>
        </div>
        <div className="line">{" "}</div>
        <div className="line">
          <span className="out"># with the byteveda core</span>
        </div>
        <div className="line">
          <span className="cmd">reclink.dedupe(records)</span> <span className="ok">→ 0.07s</span>
        </div>
        <div className="line">{" "}</div>
        <div className="line">
          <span className="pr">»</span> <span className="ok">68× faster</span>{" "}
          <span className="out">· same api</span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="aurora" aria-hidden>
        <b className="a1" />
        <b className="a2" />
        <b className="a3" />
      </div>
      <div className="blueprint" aria-hidden />
      <HeroNet />

      <div className="wrap">
        <div className="h3-grid">
          <div>
            <h1 className="h3-title">
              Tools built for engineers who care about <em>speed.</em>
            </h1>
            <p className="h3-lede">
              A small, independent group shipping fast cores, clean APIs, and no hidden agenda. MIT
              / Apache-2.0, all the way down.
            </p>
            <div className="h3-cta">
              <Button href={site.docsUrl} variant="primary" arrow="→" external>
                Read the docs
              </Button>
              <Button href={site.githubUrl} variant="ghost" arrow="↗" external>
                GitHub
              </Button>
            </div>
          </div>
          <div>
            <BenchmarkTerminal />
          </div>
        </div>
      </div>
    </section>
  );
}
