import { MobileMenu, ThemeToggle } from "@byteveda/ui";
import Link from "next/link";

import { Wordmark } from "@/components/layout/wordmark";
import { SampleButton } from "@/features/sample/components";
import { nav } from "@/lib/site";

export function Navbar() {
  return (
    <header className="nav" id="nav">
      <div className="wrap nav-inner">
        <Wordmark href="/" />

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
          <MobileMenu items={nav} brand={<Wordmark href="/" />} action={<SampleButton />} />
        </div>
      </div>
    </header>
  );
}
