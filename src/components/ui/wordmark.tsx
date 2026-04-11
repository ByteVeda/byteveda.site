import Link from "next/link";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

type WordmarkProps = {
  href?: string;
  className?: string;
};

export function Wordmark({ href = "/", className }: WordmarkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 font-mono font-semibold text-foreground text-sm tracking-tight",
        className,
      )}
    >
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-accent" />
      {site.name.toLowerCase()}
    </Link>
  );
}
