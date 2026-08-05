import type { ReactNode } from "react";
import { site } from "@/lib/site";

type Principle = {
  no: string;
  title: string;
  body: string;
  icon: ReactNode;
};

const principles: Principle[] = [
  {
    no: "01",
    title: "Performance by default",
    body: "Hot paths are written in compiled, systems-level code. No JIT gymnastics, no mystery slowdowns — just predictable, measurable speed.",
    icon: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  },
  {
    no: "02",
    title: "Ergonomic by design",
    body: "Clean, idiomatic APIs that fit the language your team already ships in — no ceremony, no friction.",
    icon: <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />,
  },
  {
    no: "03",
    title: "No strings attached",
    body: "MIT or Apache-2.0. No dual-licensing, no open-core traps. Read the source, fork it, ship it.",
    icon: (
      <>
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <rect x="4" y="11" width="16" height="10" rx="2" />
      </>
    ),
  },
];

export function About() {
  return (
    <section className="section-pad" id="about">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="marker">About</span>
          <h2>Tools built for engineers who care about how it runs.</h2>
          <p className="lede">
            {site.name} writes the kinds of libraries we wished existed when we were building our
            own systems — fast cores, clean APIs, and no hidden agenda.
          </p>
        </div>
        <div className="principles reveal">
          {principles.map((p) => (
            <article className="principle" key={p.no}>
              <span className="no">{p.no}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <svg
                className="ic"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <title>{p.title}</title>
                {p.icon}
              </svg>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
