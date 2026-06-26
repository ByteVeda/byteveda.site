import { type CSSProperties, Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type MarqueeProps<T> = {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T) => ReactNode;
  /** Scroll cycle length; lower = faster. */
  durationSeconds?: number;
  className?: string;
  trackClassName?: string;
  ariaLabel?: string;
};

/**
 * Infinite horizontal marquee. Renders the list twice so the CSS
 * `translateX(-50%)` loop is seamless. Pauses on hover and respects
 * `prefers-reduced-motion` (both handled in globals.css).
 */
export function Marquee<T>({
  items,
  getKey,
  renderItem,
  durationSeconds,
  className,
  trackClassName,
  ariaLabel,
}: MarqueeProps<T>) {
  if (items.length === 0) return null;

  const entries = [...items, ...items].map((item, i) => ({
    node: renderItem(item),
    key: `${getKey(item, i % items.length)}-${i < items.length ? "a" : "b"}`,
  }));

  const style = durationSeconds
    ? ({ "--marquee-duration": `${durationSeconds}s` } as CSSProperties)
    : undefined;

  return (
    <div
      className={cn("marquee", className)}
      style={style}
      {...(ariaLabel ? { role: "group", "aria-label": ariaLabel } : {})}
    >
      <div className={cn("marquee-track", trackClassName)}>
        {entries.map((entry) => (
          <Fragment key={entry.key}>{entry.node}</Fragment>
        ))}
      </div>
    </div>
  );
}
