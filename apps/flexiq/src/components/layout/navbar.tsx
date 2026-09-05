import { Button, ThemeToggle } from "@byteveda/ui";
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
          <Button href={site.repoUrl} variant="primary" arrow="↗" external>
            GitHub
          </Button>
        </div>
      </div>
    </header>
  );
}
