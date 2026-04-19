import Link from "next/link";
import { ArrowUpRight, Wordmark } from "@/components/ui";
import { nav } from "@/lib/site";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-border/60 border-b bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <div className="flex items-center gap-1">
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {nav.map((item) => {
              const external = "external" in item && item.external;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                  {external && <ArrowUpRight className="h-3 w-3" strokeWidth={2} />}
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
