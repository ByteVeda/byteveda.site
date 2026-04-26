import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

type NotebookTickerProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  speed?: number;
  className?: string;
  ariaLabel?: string;
};

export function NotebookTicker<T>({
  items,
  getKey,
  renderItem,
  speed = 80,
  className,
  ariaLabel,
}: NotebookTickerProps<T>) {
  if (items.length === 0) return null;

  const loop = [
    ...items.map((item, i) => ({ item, key: `${getKey(item)}-a-${i}` })),
    ...items.map((item, i) => ({ item, key: `${getKey(item)}-b-${i}` })),
  ];

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "notebook-ticker overflow-hidden border-border border-y bg-muted/20",
        className,
      )}
      style={{ "--ticker-duration": `${speed}s` } as CSSProperties}
    >
      <div className="notebook-ticker-track notebook-mono flex w-max items-center gap-x-8 whitespace-nowrap py-3 text-[13px] text-muted-foreground">
        {loop.map(({ item, key }) => (
          <span key={key} className="flex items-center gap-x-8">
            {renderItem(item)}
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
