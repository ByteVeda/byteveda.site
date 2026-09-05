import type { Metadata } from "next";
import { Playground } from "@/features/playground";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Tune a queue and watch it run: priorities, retries with exponential backoff, rate limits, dead-lettering and cron — then copy the FlexiQ code that expresses it.",
  alternates: { canonical: `${site.url}/playground` },
};

export default function PlaygroundPage() {
  return (
    <section className="wrap section-pad">
      <div className="section-head">
        <p className="kicker">Playground</p>
        <h2>Break it before you install it.</h2>
        <p>
          Every control below maps to a real task option. Burst a few hundred jobs, throttle the
          dispatcher, kill a worker mid-flight, and watch the retry budget run down — then take the
          snippet that produces exactly what you just built.
        </p>
      </div>
      <Playground />
    </section>
  );
}
