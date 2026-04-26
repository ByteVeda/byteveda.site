import { NotebookSection } from "@/components/ui";
import { site } from "@/lib/site";

const principles = [
  {
    number: "I",
    title: "Performance by default",
    body: "Hot paths are written in Rust. No JIT gymnastics, no mystery slowdowns — just predictable, measurable speed.",
  },
  {
    number: "II",
    title: "Ergonomic where it matters",
    body: "Systems languages for the engine, high-level bindings for the surface. Use the language your team already ships in.",
  },
  {
    number: "III",
    title: "No strings attached",
    body: "MIT or Apache-2.0. No dual-licensing, no open-core traps. Read the source, fork it, ship it.",
  },
];

export function About() {
  return (
    <NotebookSection
      id="about"
      index="02"
      eyebrow="about"
      title={
        <>
          Tools built for engineers
          <br className="hidden sm:inline" />
          {" who care about speed."}
        </>
      }
      subtitle="a small, independent engineering group"
      description={`${site.name} writes the kinds of libraries we wished existed when we were building our own systems — fast cores, clean APIs, and no hidden agenda.`}
    >
      <ol className="grid gap-x-10 gap-y-10 md:grid-cols-3">
        {principles.map((p) => (
          <li key={p.title} className="border-border border-l-2 pl-5">
            <p className="notebook-mono text-[11px] text-muted-foreground tracking-[0.18em]">
              No. {p.number}
            </p>
            <h3 className="notebook-headline mt-2 font-medium text-foreground text-xl leading-tight">
              {p.title}
            </h3>
            <p className="notebook-serif mt-3 text-[15px] text-muted-foreground leading-7">
              {p.body}
            </p>
          </li>
        ))}
      </ol>
    </NotebookSection>
  );
}
