import { About } from "@/components/about";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { Navbar } from "@/components/navbar";
import { News } from "@/components/news";
import { Releases } from "@/components/releases";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <About />
        <Releases limit={3} />
        <News articleLimit={3} trendingLimit={12} />
      </main>
      <Footer />
    </>
  );
}
