import {
  ArrowUpRight,
  BookText,
  Button,
  GithubIcon,
  Section,
  SectionHeader,
  TerminalChip,
} from "@/components/ui";
import {
  avatarUrl,
  contributeGuideUrl,
  contributeSteps,
  discussionsUrl,
  maintainers,
  profileUrl,
} from "../utils";

export function Contribute() {
  return (
    <Section id="contribute">
      <SectionHeader
        eyebrow="Contribute"
        title="Built in the open, shaped by contributors."
        description="ByteVeda is a small, independent engineering group. If you like squeezing microseconds out of hot paths — or just want to ship a first patch — here's how to jump in."
        align="split"
      />

      <div className="mt-14">
        <h3 className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
          Maintainers
        </h3>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {maintainers.map((m) => (
            <li key={m.login}>
              <a
                href={profileUrl(m.login)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full items-start gap-4 rounded-lg border border-border bg-background/40 p-5 transition-colors hover:border-accent/40 hover:bg-accent/5"
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
                <div className="min-w-0">
                  <p className="truncate font-medium text-base text-foreground">{m.name}</p>
                  <p className="truncate font-mono text-muted-foreground text-xs">@{m.login}</p>
                  <p className="mt-2 text-muted-foreground text-sm leading-6">{m.role}</p>
                </div>
                <ArrowUpRight
                  className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                  strokeWidth={2}
                />
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-16 border-border border-t pt-14">
        <h3 className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
          Start contributing in 5 minutes
        </h3>
        <ol className="mt-6 grid gap-4 lg:grid-cols-3">
          {contributeSteps.map((step) => (
            <li
              key={step.number}
              className="flex flex-col gap-4 rounded-lg border border-border bg-background/40 p-5"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-accent text-xs tracking-widest">{step.number}</span>
                <h4 className="font-medium text-base text-foreground">{step.title}</h4>
              </div>
              <p className="text-muted-foreground text-sm leading-6">{step.description}</p>
              {step.command && (
                <TerminalChip size="sm" block className="mt-auto">
                  {step.command}
                </TerminalChip>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button href={contributeGuideUrl} external>
            <BookText className="h-4 w-4" strokeWidth={2} />
            Contributing guide
          </Button>
          <Button href={discussionsUrl} external variant="secondary">
            <GithubIcon size={16} />
            Join the discussion
          </Button>
        </div>
      </div>
    </Section>
  );
}
