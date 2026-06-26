import { HeroNet } from "@/components/fx";
import { Button, RelativeTime } from "@/components/ui";
import type { NewsItem } from "../types";

function summarize(text: string, max = 190): string {
  const clean = text
    .replace(/[#*`>_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

function initials(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "");
  return (letters.slice(0, 2) || "BV").toUpperCase();
}

export function NewsHero({ lead }: { lead: NewsItem }) {
  const tileMeta =
    lead.labels.length > 0
      ? lead.labels.map((l) => l.toUpperCase()).join(" · ")
      : "MIT / APACHE-2.0";

  return (
    <section className="hero news-hero" id="hero">
      <div className="aurora" aria-hidden>
        <b className="a1" />
        <b className="a2" />
        <b className="a3" />
      </div>
      <div className="blueprint" aria-hidden />
      <HeroNet />

      <div className="wrap">
        <div className="news-head">
          <span className="marker">Newsroom</span>
          <h1>
            What we're shipping, <em>in the open.</em>
          </h1>
          <p className="lede">
            Release notes, engineering write-ups, and signal from the wider ecosystem. Tagged builds
            straight from the org — refreshed every few hours.
          </p>
        </div>

        <article className="lead reveal">
          <div className="lead-grid">
            <div className="lead-copy">
              <div className="lead-meta">
                <span className="tag" data-cat="release">
                  Release
                </span>
                <span aria-hidden>·</span>
                <RelativeTime value={lead.publishedAt} />
              </div>
              <h2>{lead.title}</h2>
              {lead.excerpt && <p>{summarize(lead.excerpt)}</p>}
              {lead.author && (
                <div className="byline">
                  <span className="av" aria-hidden>
                    {initials(lead.author)}
                  </span>
                  <span>{lead.author} · ByteVeda core</span>
                </div>
              )}
              <div className="lead-cta">
                <Button href={lead.url} variant="primary" arrow="↗" external>
                  Read the release
                </Button>
              </div>
            </div>
            <div className="lead-visual">
              <div className="diag-grid" aria-hidden />
              <div className="ver-tile">
                <div className="glyph" aria-hidden>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <title>Release</title>
                    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
                  </svg>
                </div>
                <div className="v">{lead.title}</div>
                <div className="meta">{tileMeta}</div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
