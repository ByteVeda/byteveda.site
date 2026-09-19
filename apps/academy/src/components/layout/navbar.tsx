import { MobileMenu, ThemeToggle, Wordmark } from "@byteveda/ui";
import Link from "next/link";

import { SampleButton } from "@/features/sample/sample-button";
import { nav } from "@/lib/site";

export function Navbar() {
  return (
    <header className="nav" id="nav">
      <div className="wrap nav-inner">
        <Wordmark href="/" label="academy" />

        <nav className="nav-links" aria-label="Primary">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="nav-right">
          <ThemeToggle />
          <SampleButton />
          <MobileMenu
            items={nav}
            brand={<Wordmark href="/" label="academy" />}
            action={<SampleButton />}
          />
        </div>
      </div>
    </header>
  );
}
