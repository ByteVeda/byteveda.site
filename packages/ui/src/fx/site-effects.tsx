"use client";

import { useEffect } from "react";

/**
 * Site-wide ambient behaviour, mounted once in the root layout:
 *  - toggles `.scrolled` on the sticky nav
 *  - drives the aurora pointer/scroll parallax (rAF-batched so high-frequency
 *    pointer events collapse to one style write per frame)
 *
 * Aurora bloom drift, scroll reveals, and the blueprint grid drift are pure
 * CSS (compositor-only transforms), gated on `prefers-reduced-motion` in the
 * stylesheet. Renders nothing.
 */
export function SiteEffects() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    // --- nav scroll state ---
    const navEl = document.getElementById("nav");
    if (navEl) {
      const onScroll = () => navEl.classList.toggle("scrolled", window.scrollY > 12);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }

    // --- aurora: pointer/scroll parallax ---
    const layer = document.querySelector<HTMLElement>(".aurora");
    if (layer && !reduced) {
      let pX = 0;
      let pY = 0;
      let sY = 0;
      let raf: number | null = null;
      const apply = () => {
        raf = null;
        layer.style.transform = `translate3d(${pX}px, ${pY + sY}px, 0)`;
      };
      const schedule = () => {
        raf ??= requestAnimationFrame(apply);
      };
      const onMove = (e: PointerEvent) => {
        pX = (e.clientX / window.innerWidth - 0.5) * -28;
        pY = (e.clientY / window.innerHeight - 0.5) * -22;
        schedule();
      };
      const onParallaxScroll = () => {
        sY = Math.min(70, window.scrollY * 0.05);
        schedule();
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("scroll", onParallaxScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("scroll", onParallaxScroll);
        if (raf !== null) cancelAnimationFrame(raf);
        layer.style.transform = "";
      });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);

  return null;
}
