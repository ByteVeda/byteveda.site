import { tools } from "@/content/tools";
import { ToolCard } from "./tool-card";
import { Section, SectionHeader } from "./ui/section";

export function ToolsSection() {
  return (
    <Section id="tools">
      <SectionHeader
        eyebrow="Tools"
        title="Five libraries, fully documented."
        description="Each tool has its own guide, API reference, and examples — all hosted on this domain under its own subpath."
        align="split"
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </Section>
  );
}
