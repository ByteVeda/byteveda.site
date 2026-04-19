import { Section } from "@/components/ui";
import { site } from "@/lib/site";

const principles = [
  {
    title: "Performance by default",
    body: "Hot paths are written in Rust. No JIT gymnastics, no mystery slowdowns — just predictable, measurable speed.",
  },
  {
    title: "Ergonomic where it matters",
    body: "Systems languages for the engine, high-level bindings for the surface. Use the language your team already ships in.",
  },
  {
    title: "No strings attached",
    body: "MIT or Apache-2.0. No dual-licensing, no open-core traps. Read the source, fork it, ship it.",
  },
];

export function About() {
  return (
    <Section id="about">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">About</p>
          <h2 className="mt-2 font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
            Tools built for engineers who care about speed.
          </h2>
          <p className="mt-6 text-base text-muted-foreground leading-7">
            {site.name} is a small, independent engineering group. We write the kinds of libraries
            we wished existed when we were building our own systems — fast cores, clean APIs, and no
            hidden agenda.
          </p>
        </div>

        <dl className="grid gap-6 sm:grid-cols-2 lg:gap-8">
          {principles.map((p) => (
            <div key={p.title} className="rounded-lg border border-border bg-background/40 p-5">
              <dt className="font-mono font-semibold text-foreground text-sm">{p.title}</dt>
              <dd className="mt-2 text-muted-foreground text-sm leading-6">{p.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
