import Link from "next/link";
import { ArrowRight, Section, SectionHeader } from "@/components/ui";
import { NewsCard, type NewsItem } from "@/features/news";
import { cn } from "@/lib/cn";

type Density = "comfortable" | "dense";

type FeedSectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  items: NewsItem[];
  density?: Density;
  emptyMessage?: string;
  viewAll?: { href: string; label: string };
};

const GRID: Record<Density, string> = {
  comfortable: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  dense: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
};

export function FeedSection({
  id,
  eyebrow,
  title,
  description,
  items,
  density = "comfortable",
  emptyMessage,
  viewAll,
}: FeedSectionProps) {
  if (items.length === 0 && !emptyMessage) return null;

  return (
    <Section id={id}>
      <SectionHeader align="split" eyebrow={eyebrow} title={title} description={description} />
      {items.length === 0 ? (
        <p className="mt-10 font-mono text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <div className={cn("mt-10", GRID[density])}>
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {viewAll && items.length > 0 && (
        <div className="mt-8">
          <Link
            href={viewAll.href}
            className="inline-flex items-center gap-1.5 font-mono text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            {viewAll.label}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
      )}
    </Section>
  );
}
