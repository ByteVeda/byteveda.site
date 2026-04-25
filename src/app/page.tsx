import { About, Hero, Releases } from "@/components/sections";
import { News } from "@/features/news";

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <Releases limit={3} />
      <News articleLimit={3} />
    </>
  );
}
