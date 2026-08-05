import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "accent";

const variants: Record<Variant, string> = {
  default: "border border-border bg-muted/40 text-muted-foreground",
  outline: "border border-border text-muted-foreground",
  accent: "border border-accent/40 bg-accent/10 text-accent",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] leading-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
