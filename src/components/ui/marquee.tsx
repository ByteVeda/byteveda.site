import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

type MarqueeProps<T> = {
  items: T[];
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
  /** Seconds per full cycle at the default speed. Higher = slower. */
  secondsPerItem?: number;
  gapClassName?: string;
  itemClassName?: string;
  className?: string;
  edgeFadeWidth?: number;
};

export function Marquee<T>({
  items,
  renderItem,
  getKey,
  secondsPerItem = 6,
  gapClassName = "gap-4",
  itemClassName,
  className,
  edgeFadeWidth = 64,
}: MarqueeProps<T>) {
  if (items.length === 0) return null;

  const duration = Math.max(12, items.length * secondsPerItem);
  const trackStyle = { "--marquee-duration": `${duration}s` } as CSSProperties;
  const fadeStyle = { width: `${edgeFadeWidth}px` };

  return (
    <div className={cn("marquee-container group relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 bg-gradient-to-r from-background to-transparent"
        style={fadeStyle}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 bg-gradient-to-l from-background to-transparent"
        style={fadeStyle}
      />
      <div className={cn("marquee-track flex w-max", gapClassName)} style={trackStyle}>
        {items.map((item) => (
          <div key={getKey(item)} className={cn("flex-shrink-0", itemClassName)}>
            {renderItem(item)}
          </div>
        ))}
        {items.map((item) => (
          <div
            key={`dup-${getKey(item)}`}
            aria-hidden
            className={cn("flex-shrink-0", itemClassName)}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
