import { site } from "@/lib/site";

const installs = [
  "pip install taskito",
  "pip install paperjam",
  "pip install reclink",
  "pip install dagron",
];

const CYCLE_SECONDS = installs.length * 2;
const MAX_INSTALL_LENGTH = Math.max(...installs.map((cmd) => cmd.length));

function HeroFigure() {
  return (
    <figure className="hidden flex-shrink-0 text-muted-foreground lg:block">
      <svg
        viewBox="0 0 144 120"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="A schematic of a chip with pins on each side and a small index notch"
        className="h-30 w-36"
      >
        <title>A schematic of a chip with pins on each side and an index notch</title>
        <rect x="36" y="30" width="72" height="60" />
        <rect x="50" y="44" width="44" height="32" opacity="0.65" />
        <line x1="28" y1="42" x2="36" y2="42" />
        <line x1="28" y1="54" x2="36" y2="54" />
        <line x1="28" y1="66" x2="36" y2="66" />
        <line x1="28" y1="78" x2="36" y2="78" />
        <line x1="108" y1="42" x2="116" y2="42" />
        <line x1="108" y1="54" x2="116" y2="54" />
        <line x1="108" y1="66" x2="116" y2="66" />
        <line x1="108" y1="78" x2="116" y2="78" />
        <line x1="48" y1="22" x2="48" y2="30" />
        <line x1="60" y1="22" x2="60" y2="30" />
        <line x1="72" y1="22" x2="72" y2="30" />
        <line x1="84" y1="22" x2="84" y2="30" />
        <line x1="96" y1="22" x2="96" y2="30" />
        <line x1="48" y1="90" x2="48" y2="98" />
        <line x1="60" y1="90" x2="60" y2="98" />
        <line x1="72" y1="90" x2="72" y2="98" />
        <line x1="84" y1="90" x2="84" y2="98" />
        <line x1="96" y1="90" x2="96" y2="98" />
        <circle cx="42" cy="36" r="1.4" fill="currentColor" stroke="none" />
      </svg>
      <figcaption className="notebook-mono mt-2 text-[10px] text-muted-foreground tracking-wide">
        FIG.0 — the engine
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section className="border-border border-b">
      <div className="mx-auto max-w-5xl px-6 py-24 md:px-10 md:py-32">
        <header className="flex items-start justify-between gap-10">
          <div className="min-w-0 flex-1">
            <p className="notebook-mono flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              <span>§ 01</span>
              <span aria-hidden>·</span>
              <span>byteveda</span>
            </p>

            <h1 className="notebook-headline mt-6 font-medium text-5xl text-foreground leading-[0.95] md:text-7xl">
              Fast tools
              <br />
              for high-performance
              <br />
              systems.
            </h1>

            <p className="notebook-serif mt-5 flex items-baseline gap-3 text-[15px] text-muted-foreground italic">
              <span aria-hidden className="text-muted-foreground/60">
                ───
              </span>
              rust cores. ergonomic bindings.
            </p>

            <p className="notebook-serif mt-8 max-w-2xl text-[17px] text-foreground/85 leading-[1.7]">
              {site.name} builds libraries with Rust cores and ergonomic bindings for Python, Java,
              and beyond — so you get native speed without giving up the language you already ship
              in.
            </p>

            <div className="mt-9 flex flex-wrap items-baseline gap-x-6 gap-y-3 notebook-serif text-[15px]">
              <a
                href={site.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline decoration-1 underline-offset-4 transition-colors hover:text-foreground"
              >
                browse the tools →
              </a>
              <a
                href={site.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground italic underline decoration-dotted underline-offset-4 transition-colors hover:text-accent"
              >
                github ↗
              </a>
            </div>

            <div className="mt-10 inline-flex items-center gap-3 border-accent/40 border-l-2 bg-muted/40 py-2 pr-6 pl-4 notebook-mono text-[13px]">
              <span className="select-none text-accent">$</span>
              <div
                className="relative h-5 overflow-hidden"
                style={{ width: `${MAX_INSTALL_LENGTH + 1}ch` }}
              >
                {installs.map((cmd, i) => (
                  <span
                    key={cmd}
                    className="absolute inset-0 whitespace-nowrap text-foreground"
                    style={{
                      animation: `install-cycle ${CYCLE_SECONDS}s ${i * 2}s infinite backwards`,
                    }}
                  >
                    {cmd}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <HeroFigure />
        </header>
      </div>
    </section>
  );
}
