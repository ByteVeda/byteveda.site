import Link from "next/link";
import { cn } from "@/lib/cn";
import { nav } from "@/lib/site";
import { ThemeToggle } from "./theme-toggle";
import { ArrowUpRight } from "./ui/icons";
import { Wordmark } from "./ui/wordmark";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-border/60 border-b bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <nav className="flex items-center gap-1 text-sm">
          {nav.map((item) => {
            const external = "external" in item && item.external;
            return (
              <Link
                key={item.href}
                href={item.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className={cn(
                  "hidden items-center gap-1 rounded-md px-3 py-1.5 sm:inline-flex",
                  "text-muted-foreground transition-colors hover:text-foreground",
                )}
              >
                {item.label}
                {external && <ArrowUpRight className="h-3 w-3" strokeWidth={2} />}
              </Link>
            );
          })}
          <div className="ml-1">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
