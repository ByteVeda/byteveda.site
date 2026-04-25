import Link from "next/link";
import { NotebookSection } from "@/components/ui";
import { getReleases, NewsEntry } from "@/features/news";
import { site } from "@/lib/site";

type ReleasesProps = {
  limit?: number;
};

export function Releases({ limit = 3 }: ReleasesProps) {
  const items = getReleases(limit);
  if (items.length === 0) return null;

  return (
    <NotebookSection
      id="releases"
      index="03"
      eyebrow="releases"
      title="Recent releases"
      subtitle="latest tagged builds from the org"
    >
      <ol className="divide-y divide-border">
        {items.map((item, i) => (
          <NewsEntry key={item.id} item={item} index={i + 1} />
        ))}
      </ol>

      <div className="mt-10">
        <Link
          href={`${site.githubUrl}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className="notebook-serif inline-flex items-baseline gap-2 text-[15px] text-accent italic underline decoration-1 underline-offset-4 transition-colors hover:text-foreground"
        >
          all repositories on github →
        </Link>
      </div>
    </NotebookSection>
  );
}
