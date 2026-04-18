import Link from "next/link";
import { cn } from "@/lib/cn";
import { type Label, type NewsItem, sourceLabel } from "@/lib/news";
import { Badge } from "./ui/badge";
import { ArrowUpRight, Star } from "./ui/icons";
import { RelativeTime } from "./ui/relative-time";

type NewsCardProps = {
  item: NewsItem;
  className?: string;
  maxLabels?: number;
};

function primaryBadge(item: NewsItem) {
  switch (item.kind) {
    case "release":
      return <Badge variant="accent">Release</Badge>;
    case "trending":
      return <Badge variant="accent">Trending</Badge>;
    default:
      return (
        <Badge variant={item.mentionsByteveda ? "accent" : "default"}>
          {sourceLabel(item.source)}
        </Badge>
      );
  }
}

function LabelPills({ labels, max }: { labels: Label[]; max: number }) {
  if (labels.length === 0) return null;
  return (
    <>
      {labels.slice(0, max).map((label) => (
        <Badge key={label} variant="outline">
          {label}
        </Badge>
      ))}
    </>
  );
}

function metaLeft(item: NewsItem) {
  if (item.kind === "trending") {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Star className="h-3 w-3" strokeWidth={2} />
        <span className="tabular-nums">{item.score.toLocaleString()}</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {item.author && <span className="truncate">{item.author}</span>}
      {item.author && <span aria-hidden>·</span>}
      <RelativeTime value={item.publishedAt} />
    </span>
  );
}

export function NewsCard({ item, className, maxLabels = 2 }: NewsCardProps) {
  const showFeatured = item.kind === "article" && item.mentionsByteveda;

  return (
    <Link
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex h-full min-h-[260px] flex-col justify-between gap-4 rounded-lg border border-border bg-background/40 p-5",
        "transition-colors hover:border-accent/40 hover:bg-accent/5",
        className,
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {primaryBadge(item)}
          {showFeatured && <Badge variant="outline">Featured</Badge>}
          <LabelPills labels={item.labels} max={maxLabels} />
        </div>
        <h3 className="line-clamp-2 font-medium text-base text-foreground leading-snug tracking-tight">
          {item.title}
        </h3>
        {item.excerpt && (
          <p className="line-clamp-3 text-muted-foreground text-sm leading-6">{item.excerpt}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 font-mono text-muted-foreground text-xs">
        {metaLeft(item)}
        <ArrowUpRight
          className="h-3.5 w-3.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}
