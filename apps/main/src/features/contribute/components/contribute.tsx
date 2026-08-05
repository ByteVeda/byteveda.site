import { NotebookSection } from "@/components/ui";
import {
  avatarUrl,
  contributeGuideUrl,
  contributeSteps,
  discussionsUrl,
  maintainers,
  profileUrl,
} from "../utils";

function ContributeFigure() {
  return (
    <figure className="hidden flex-shrink-0 text-muted-foreground md:block">
      <svg
        viewBox="0 0 144 120"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="A pencil drawing across a notebook page"
        className="h-30 w-36"
      >
        <title>A pencil drawing across a notebook page</title>
        <rect x="22" y="22" width="100" height="76" />
        <line x1="22" y1="38" x2="122" y2="38" opacity="0.45" />
        <path d="M 32 56 L 60 56 L 70 64 L 90 48 L 110 56" opacity="0.7" />
        <line x1="32" y1="76" x2="100" y2="76" />
        <line x1="32" y1="84" x2="84" y2="84" />
        <path d="M 96 92 L 116 72 L 122 78 L 102 98 Z" />
        <line x1="113" y1="79" x2="119" y2="85" opacity="0.55" />
      </svg>
      <figcaption className="notebook-mono mt-2 text-[10px] text-muted-foreground tracking-wide">
        FIG.1 — the patch
      </figcaption>
    </figure>
  );
}

export function Contribute() {
  return (
    <NotebookSection
      id="contribute"
      index="01"
      eyebrow="contribute"
      title={
        <>
          Built in the open,
          <br className="hidden sm:inline" />
          {" shaped by contributors."}
        </>
      }
      subtitle="a small, independent engineering group"
      description="If you like squeezing microseconds out of hot paths — or just want to ship a first patch — here's how to jump in."
      figure={<ContributeFigure />}
    >
      <div className="space-y-16">
        <section aria-labelledby="contribute-maintainers">
          <h3
            id="contribute-maintainers"
            className="notebook-smallcaps text-[14px] text-foreground"
          >
            Maintainers
          </h3>
          <ul className="mt-6 space-y-6">
            {maintainers.map((m) => (
              <li key={m.login}>
                <a
                  href={profileUrl(m.login)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-5 border-transparent border-l-2 py-2 pl-5 transition-colors hover:border-accent hover:bg-muted/40"
                >
                  {/** biome-ignore lint/performance/noImgElement: GitHub avatar URLs redirect; plain <img> avoids remotePatterns churn */}
                  <img
                    src={avatarUrl(m.login)}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-14 w-14 flex-shrink-0 rounded-full border border-border"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="notebook-headline truncate font-medium text-foreground text-xl leading-tight">
                      {m.name}
                    </p>
                    <p className="notebook-mono mt-1 truncate text-[12px] text-muted-foreground">
                      @{m.login}
                    </p>
                    <p className="notebook-serif mt-2 text-[15px] text-muted-foreground leading-7">
                      {m.role}
                    </p>
                  </div>
                  <span className="notebook-mono pt-2 text-[12px] text-accent transition-transform group-hover:translate-x-0.5">
                    profile ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="contribute-steps">
          <h3 id="contribute-steps" className="notebook-smallcaps text-[14px] text-foreground">
            Start contributing in 5 minutes
          </h3>
          <ol className="mt-8 space-y-10">
            {contributeSteps.map((step) => (
              <li key={step.number} className="grid gap-4 md:grid-cols-[80px_1fr]">
                <p className="notebook-mono text-[11px] text-muted-foreground tracking-[0.18em]">
                  Step {step.number}
                </p>
                <div>
                  <h4 className="notebook-headline font-medium text-foreground text-xl leading-tight">
                    {step.title}
                  </h4>
                  <p className="notebook-serif mt-3 max-w-2xl text-[15px] text-muted-foreground leading-7">
                    {step.description}
                  </p>
                  {step.command && (
                    <div className="notebook-mono mt-4 inline-flex items-center gap-3 border-accent/40 border-l-2 bg-muted/40 py-2 pr-6 pl-4 text-[13px]">
                      <span className="select-none text-accent">$</span>
                      <span className="text-foreground">{step.command}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="notebook-serif mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-3 text-[15px]">
            <a
              href={contributeGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-1 underline-offset-4 transition-colors hover:text-foreground"
            >
              read the contributing guide →
            </a>
            <a
              href={discussionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground italic underline decoration-dotted underline-offset-4 transition-colors hover:text-accent"
            >
              join the discussion ↗
            </a>
          </div>
        </section>
      </div>
    </NotebookSection>
  );
}
