import Link from "next/link";
import { Button, Wordmark } from "@/components/ui";
import { nav, site } from "@/lib/site";
import { isExternalUrl } from "@/lib/url";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  return (
    <header className="nav" id="nav">
      <div className="wrap nav-inner">
        <Wordmark href="/" />

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
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
