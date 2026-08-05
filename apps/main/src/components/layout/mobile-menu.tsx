"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Wordmark } from "@/components/ui";
import { cn } from "@/lib/cn";
import { nav, site } from "@/lib/site";
import { isExternalUrl } from "@/lib/url";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal target only exists after mount (avoids SSR `document` access).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="icon-btn menu-btn"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-drawer"
        onClick={() => setOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          aria-hidden
        >
          <title>Menu</title>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {mounted &&
        createPortal(
          <div className={cn("drawer-root", open && "open")} aria-hidden={!open}>
            <button
              type="button"
              className="drawer-scrim"
              aria-label="Close menu"
              onClick={close}
            />
            <aside
              id="mobile-drawer"
              className="drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
            >
              <div className="drawer-head">
                <Wordmark href="/" />
                <button type="button" className="icon-btn" aria-label="Close menu" onClick={close}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <title>Close</title>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <nav className="drawer-links" aria-label="Mobile">
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
                      onClick={close}
                    >
                      {label}
                    </a>
                  ) : (
                    <Link key={item.href} href={item.href} onClick={close}>
                      {label}
                    </Link>
                  );
                })}
                <Link href="/contribute" onClick={close}>
                  Contribute
                </Link>
              </nav>

              <div className="drawer-foot">
                <Button href={site.githubUrl} variant="primary" arrow="↗" external>
                  GitHub
                </Button>
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
