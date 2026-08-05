import { Section, SectionHeader } from "@byteveda/ui";
import { projects } from "@byteveda/utils";
import { ToolCard } from "./tool-card";

export function ToolsSection() {
  return (
    <Section id="tools" glow>
      <SectionHeader
        eyebrow="Tools"
        title="Five libraries, fully documented."
        description="Each tool has its own guide, API reference, and examples — all hosted on this domain under its own subpath."
        align="split"
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ToolCard key={project.slug} tool={project} />
        ))}
      </div>
    </Section>
  );
}
