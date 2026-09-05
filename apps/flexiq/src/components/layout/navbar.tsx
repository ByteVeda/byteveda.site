import { OctocatIcon, ThemeToggle } from "@byteveda/ui";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { nav, site } from "@/lib/site";

export function Navbar() {
  return (
    <header className="nav" id="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand">
          <Wordmark />
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="nav-right">
          <ThemeToggle />
          <a
            className="icon-btn"
            href={site.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="FlexiQ on GitHub"
          >
            <OctocatIcon aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}
