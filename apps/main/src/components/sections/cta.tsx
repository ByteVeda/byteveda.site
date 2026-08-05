import { Button } from "@/components/ui";
import { site } from "@/lib/site";

export function Cta() {
  return (
    <section className="wrap" style={{ paddingBottom: "clamp(20px, 4vw, 40px)" }}>
      <div className="cta reveal">
        <div className="blueprint" aria-hidden />
        <div className="cta-inner">
          <span className="eyebrow">
            <span className="tick" aria-hidden />
            Contribute
          </span>
          <h2>Fast software, built in the open.</h2>
          <p>
            Read the source, file an issue, or ship a PR. Everything {site.name} makes is MIT /
            Apache-2.0 — yours to fork and run.
          </p>
          <div className="cta-row">
            <Button href={site.githubUrl} variant="primary" arrow="↗" external>
              Start contributing
            </Button>
            <Button href={site.docsUrl} variant="ghost" arrow="→" external>
              Read the docs
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
