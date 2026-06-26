"use client";

import anime from "animejs";
import { useEffect } from "react";

/**
 * Site-wide ambient behaviour, mounted once in the root layout:
 *  - toggles `.scrolled` on the sticky nav
 *  - drives the aurora blooms (independent breathing + pointer/scroll parallax)
 *
 * Scroll reveals are handled entirely in CSS (scroll-driven animations) so no
 * JS mutates React-controlled class names — that previously caused hydration
 * mismatches. All motion is gated on `prefers-reduced-motion`. Renders nothing.
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

    // --- aurora: breathing + parallax ---
    const layer = document.querySelector<HTMLElement>(".aurora");
    if (layer && !reduced) {
      const blooms: Array<{ el: string; tx: number[]; ty: number[]; sc: number[]; d: number }> = [
        { el: ".aurora .a1", tx: [115, -55], ty: [72, -42], sc: [1.2, 1.0], d: 16000 },
        { el: ".aurora .a2", tx: [-95, 62], ty: [-52, 44], sc: [1.14, 1.0], d: 19500 },
        { el: ".aurora .a3", tx: [60, -74], ty: [-84, 34], sc: [1.24, 1.02], d: 14000 },
      ];
      blooms.forEach((c, i) => {
        anime({
          targets: c.el,
          translateX: c.tx,
          translateY: c.ty,
          scale: c.sc,
          easing: "easeInOutSine",
          direction: "alternate",
          loop: true,
          duration: c.d,
          delay: i * 1300,
        });
      });

      let pX = 0;
      let pY = 0;
      let sY = 0;
      const apply = () => {
        layer.style.transform = `translate(${pX}px,${pY + sY}px)`;
      };
      const onMove = (e: PointerEvent) => {
        pX = (e.clientX / window.innerWidth - 0.5) * -28;
        pY = (e.clientY / window.innerHeight - 0.5) * -22;
        apply();
      };
      const onParallaxScroll = () => {
        sY = Math.min(70, window.scrollY * 0.05);
        apply();
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("scroll", onParallaxScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("scroll", onParallaxScroll);
        blooms.forEach((c) => {
          anime.remove(c.el);
        });
        layer.style.transform = "";
      });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);

  return null;
}
