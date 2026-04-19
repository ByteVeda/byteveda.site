"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "@/components/ui";
import { nav } from "@/lib/site";
import { isExternalUrl } from "@/lib/url";

const linkClass =
  "flex items-center gap-1 rounded-md px-2 py-2.5 text-muted-foreground transition-colors hover:text-foreground";

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground sm:hidden"
      >
        {open ? (
          <X className="h-5 w-5" strokeWidth={2} />
        ) : (
          <Menu className="h-5 w-5" strokeWidth={2} />
        )}
      </button>
      {open && (
        <nav className="absolute top-full right-0 left-0 border-border/60 border-t bg-background/95 backdrop-blur-md sm:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-6 py-3 text-sm">
            {nav.map((item) => {
              const openInNewTab = "external" in item && item.external;
              const label = (
                <>
                  {item.label}
                  {openInNewTab && <ArrowUpRight className="h-3 w-3" strokeWidth={2} />}
                </>
              );

              return (
                <li key={item.href}>
                  {isExternalUrl(item.href) ? (
                    <a
                      href={item.href}
                      target={openInNewTab ? "_blank" : undefined}
                      rel={openInNewTab ? "noopener noreferrer" : undefined}
                      onClick={close}
                      className={linkClass}
                    >
                      {label}
                    </a>
                  ) : (
                    <Link href={item.href} onClick={close} className={linkClass}>
                      {label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
