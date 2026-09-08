"use client";

import { cn, isExternalUrl } from "@byteveda/utils";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type MobileMenuItem = {
  label: string;
  href: string;
  /** Opens in a new tab with an ↗ glyph. Sibling ByteVeda domains are not external. */
  external?: boolean;
};

type MobileMenuProps = {
  items: readonly MobileMenuItem[];
  /** The lockup for the drawer head. Each app brings its own. */
  brand: ReactNode;
  /** Call to action pinned to the foot — the nav row hides its own below 940px. */
  action?: ReactNode;
};

/**
 * The drawer every ByteVeda site falls back to once `.nav-links` is hidden.
 *
 * Below 940px the horizontal nav does not fit — it pushed the docs site 250px
 * past its own viewport before this existed — so the links move in here and the
 * button that opens it is the only way to reach them. That makes this component
 * load-bearing on a phone rather than decorative.
 */
export function MobileMenu({ items, brand, action }: MobileMenuProps) {
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

  const link = (item: MobileMenuItem) => {
    const label = (
      <>
        {item.label}
        {item.external && <span aria-hidden>↗</span>}
      </>
    );
    return isExternalUrl(item.href) ? (
      <a
        key={item.href}
        href={item.href}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener noreferrer" : undefined}
        onClick={close}
      >
        {label}
      </a>
    ) : (
      <Link key={item.href} href={item.href} onClick={close}>
        {label}
      </Link>
    );
  };

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
                {brand}
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
                {items.map(link)}
              </nav>

              {action && <div className="drawer-foot">{action}</div>}
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
