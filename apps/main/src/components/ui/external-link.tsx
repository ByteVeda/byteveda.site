import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ArrowUpRight } from "./icons";

type ExternalLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  showIcon?: boolean;
  icon?: ReactNode;
};

export function ExternalLink({
  href,
  children,
  className,
  showIcon = true,
  icon,
}: ExternalLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {icon}
      {children}
      {showIcon && <ArrowUpRight className="h-3 w-3" strokeWidth={2} />}
    </Link>
  );
}
