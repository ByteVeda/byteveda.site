import { DocsHero } from "@/components/docs-hero";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { ToolsSection } from "@/components/tools-section";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <DocsHero />
        <ToolsSection />
      </main>
      <Footer />
    </>
  );
}
