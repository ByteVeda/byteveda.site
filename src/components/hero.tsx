import { site } from "@/lib/site";
import { Button } from "./ui/button";
import { ArrowRight, GithubIcon } from "./ui/icons";

const installs = [
  "pip install taskito",
  "pip install paperjam",
  "pip install reclink",
  "pip install dagron",
];

const CYCLE_SECONDS = installs.length * 2;
const MAX_INSTALL_LENGTH = Math.max(...installs.map((cmd) => cmd.length));

export function Hero() {
  return (
    <section className="relative overflow-hidden border-border border-b">
      <div
        aria-hidden
        className="dot-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-28 md:py-36">
        <div className="fade-up max-w-3xl">
          <h1 className="font-semibold text-4xl text-foreground tracking-tight sm:text-5xl md:text-6xl md:leading-[1.05]">
            Fast tools
            <br />
            for high-performance systems.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-7 md:text-lg">
            {site.name} builds libraries with Rust cores and ergonomic bindings for Python, Java,
            and beyond — so you get native speed without giving up the language you already ship in.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href={site.docsUrl} external>
              Browse the tools
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button href={site.githubUrl} external variant="secondary">
              <GithubIcon size={16} />
              GitHub
            </Button>
          </div>
          <div className="mt-10 inline-flex items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-2.5 font-mono text-muted-foreground text-sm">
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
      </div>
    </section>
  );
}
