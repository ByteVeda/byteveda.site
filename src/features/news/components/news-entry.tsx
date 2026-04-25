import Link from "next/link";
import { ArrowUpRight, RelativeTime } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { NewsItem } from "../types";
import { sourceLabel } from "../utils";

type NewsEntryProps = {
  item: NewsItem;
  index: number;
};

function formatNumber(n: number): string {
  return String(n).padStart(4, "0");
}

export function NewsEntry({ item, index }: NewsEntryProps) {
  return (
    <li className="group relative">
      <Link
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "block border-transparent border-l-2 py-7 pr-2 pl-6 transition-colors",
          "group-hover:border-accent group-hover:bg-muted/40",
        )}
      >
        <div className="notebook-mono flex items-baseline gap-2 text-[11px] text-muted-foreground tracking-wide">
          <span className="tabular-nums">№ {formatNumber(index)}</span>
          <span aria-hidden>·</span>
          <span>{sourceLabel(item.source)}</span>
          {item.author && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{item.author}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <RelativeTime value={item.publishedAt} />
          {item.mentionsByteveda && (
            <>
              <span aria-hidden>·</span>
              <span className="notebook-serif text-accent italic">featured</span>
            </>
          )}
        </div>

        <h3 className="notebook-headline mt-3 line-clamp-2 font-medium text-2xl text-foreground leading-snug md:text-3xl">
          {item.title}
        </h3>

        {item.excerpt && (
          <p className="notebook-serif mt-3 line-clamp-3 max-w-3xl text-[15px] text-muted-foreground leading-7">
            {item.excerpt}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {item.labels.length > 0 && (
            <div className="notebook-smallcaps flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
              {item.labels.map((label, i) => (
                <span key={label} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden>·</span>}
                  <span>{label}</span>
                </span>
              ))}
            </div>
          )}
          <span className="notebook-mono ml-auto inline-flex items-center gap-1 text-[12px] text-accent transition-transform group-hover:translate-x-0.5">
            read
            <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </span>
        </div>
      </Link>
    </li>
  );
}
