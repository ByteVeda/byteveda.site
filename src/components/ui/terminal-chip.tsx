import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md";

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
};

type TerminalChipProps = {
  children: ReactNode;
  className?: string;
  prompt?: string;
  size?: Size;
  block?: boolean;
};

export function TerminalChip({
  children,
  className,
  prompt = "$",
  size = "md",
  block = false,
}: TerminalChipProps) {
  return (
    <div
      className={cn(
        "items-center gap-3 rounded-md border border-border bg-muted/40 font-mono text-muted-foreground",
        sizes[size],
        block ? "flex w-full overflow-x-auto" : "inline-flex",
        className,
      )}
    >
      <span className="select-none text-accent">{prompt}</span>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
