import Link from "next/link";
import { ArrowUpRight, Wordmark } from "@/components/ui";
import { nav } from "@/lib/site";
import { isExternalUrl } from "@/lib/url";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";

const linkClass =
  "notebook-serif inline-flex items-center gap-1 px-3 py-1.5 text-[15px] text-muted-foreground transition-colors hover:text-foreground";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-border/60 border-b bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <div className="flex items-center gap-1">
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {nav.map((item) => {
              const openInNewTab = "external" in item && item.external;
              const label = (
                <>
                  {item.label}
                  {openInNewTab && <ArrowUpRight className="h-3 w-3" strokeWidth={2} />}
                </>
              );

              if (isExternalUrl(item.href)) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target={openInNewTab ? "_blank" : undefined}
                    rel={openInNewTab ? "noopener noreferrer" : undefined}
                    className={linkClass}
                  >
                    {label}
                  </a>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={linkClass}>
                  {label}
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
