import { Button, ThemeToggle, Wordmark } from "@byteveda/ui";
import { isExternalUrl } from "@byteveda/utils";
import Link from "next/link";
import { nav, site } from "@/lib/site";

/**
 * Same shell as the landing site's navbar (`.nav` / `.nav-inner` / `.nav-links`
 * come from @byteveda/ui) with the docs section marker after the wordmark.
 */
export function Navbar() {
  return (
    <header className="nav" id="nav">
      <div className="wrap nav-inner">
        <div className="flex items-center gap-3">
          <Wordmark href={site.homeUrl} />
          <span aria-hidden className="notebook-mono text-faint">
            /
          </span>
          <Link href="/" className="notebook-mono text-muted-foreground text-sm hover:text-accent">
            {site.section}
          </Link>
        </div>

        <nav className="nav-links" aria-label="Primary">
          {nav.map((item) => {
            const external = "external" in item && item.external;
            const label = (
              <>
                {item.label}
                {external && <span aria-hidden>↗</span>}
              </>
            );
            return isExternalUrl(item.href) ? (
              <a
                key={item.href}
                href={item.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
              >
                {label}
              </a>
            ) : (
              <Link key={item.href} href={item.href}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="nav-right">
          <ThemeToggle />
          <Button href={site.githubUrl} variant="primary" arrow="↗" external>
            GitHub
          </Button>
        </div>
      </div>
    </header>
  );
}
