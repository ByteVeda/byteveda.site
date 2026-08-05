"use client";

import { useEffect, useRef } from "react";

const LINK = 132; // px distance at which nodes connect
const MOUSE_LINK = 168; // px distance for cursor links

type Node = { x: number; y: number; vx: number; vy: number; r: number };

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n) || h.length < 6) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Hero connective network: drifting nodes + proximity links + gentle cursor
 * pull. Accent- and theme-aware (reads `--accent`, re-reads on `.dark` toggle),
 * pauses off-screen / on hidden tab, honours `prefers-reduced-motion`.
 */
export function HeroNet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.closest<HTMLElement>("[data-hero-fx]") ?? canvas?.parentElement ?? null;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !hero || !ctx) return;

    const root = document.documentElement;
    const reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    let W = 0;
    let H = 0;
    let heroLeft = 0;
    let heroTopDoc = 0;
    let nodes: Node[] = [];
    let rgb: [number, number, number] = [31, 157, 84];
    let raf: number | null = null;
    let onScreen = true;
    const mouse = { x: -9999, y: -9999, on: false };

    const readAccent = () => {
      const parsed = hexToRgb(getComputedStyle(root).getPropertyValue("--accent"));
      if (parsed) rgb = parsed;
    };
    const rgba = (a: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

    const build = () => {
      const r = hero.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      heroLeft = r.left;
      heroTopDoc = r.top + window.scrollY;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(60, Math.max(18, (W * H) / 19000)));
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: 1.1 + Math.random() * 1.6,
        });
      }
    };

    // Segments are grouped into a few alpha buckets so each frame issues one
    // stroke() per bucket instead of one per link (~300 at full density).
    const BUCKETS = 8;
    const linkBuckets: number[][] = Array.from({ length: BUCKETS }, () => []);

    const bucketFor = (t: number) => Math.min(BUCKETS - 1, Math.floor(t * BUCKETS));

    const strokeBuckets = (maxAlpha: number) => {
      for (let k = 0; k < BUCKETS; k++) {
        const seg = linkBuckets[k];
        if (seg.length === 0) continue;
        ctx.strokeStyle = rgba(((k + 0.5) / BUCKETS) * maxAlpha);
        ctx.beginPath();
        for (let s = 0; s < seg.length; s += 4) {
          ctx.moveTo(seg[s], seg[s + 1]);
          ctx.lineTo(seg[s + 2], seg[s + 3]);
        }
        ctx.stroke();
        seg.length = 0;
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            linkBuckets[bucketFor(1 - Math.sqrt(d2) / LINK)].push(a.x, a.y, b.x, b.y);
          }
        }
      }
      strokeBuckets(0.22);

      if (mouse.on) {
        for (const a of nodes) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MOUSE_LINK * MOUSE_LINK) {
            const t = 1 - Math.sqrt(d2) / MOUSE_LINK;
            linkBuckets[bucketFor(t)].push(a.x, a.y, mouse.x, mouse.y);
            a.vx += (dx > 0 ? -1 : 1) * 0.0009 * t;
            a.vy += (dy > 0 ? -1 : 1) * 0.0009 * t;
          }
        }
        strokeBuckets(0.5);
      }

      ctx.fillStyle = rgba(0.55);
      ctx.beginPath();
      for (const a of nodes) {
        ctx.moveTo(a.x + a.r, a.y);
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    const step = () => {
      for (const a of nodes) {
        a.x += a.vx;
        a.y += a.vy;
        a.vx *= 0.992;
        a.vy *= 0.992;
        if (a.vx > -0.04 && a.vx < 0.04) a.vx += (Math.random() - 0.5) * 0.01;
        if (a.vy > -0.04 && a.vy < 0.04) a.vy += (Math.random() - 0.5) * 0.01;
        if (a.x < -10) a.x = W + 10;
        else if (a.x > W + 10) a.x = -10;
        if (a.y < -10) a.y = H + 10;
        else if (a.y > H + 10) a.y = -10;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (raf || reduceMQ.matches || !onScreen) return;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    let resizeT: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeT) clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        build();
        draw();
      }, 150);
    };
    // Uses offsets cached in build() — hero sits at a fixed document position,
    // so a getBoundingClientRect() here would force layout on every move.
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX - heroLeft;
      mouse.y = e.clientY - (heroTopDoc - window.scrollY);
      mouse.on = true;
    };
    const onLeave = () => {
      mouse.on = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onReduceChange = () => {
      if (reduceMQ.matches) {
        stop();
        draw();
      } else {
        start();
      }
    };

    window.addEventListener("resize", onResize, { passive: true });
    hero.addEventListener("pointermove", onMove, { passive: true });
    hero.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMQ.addEventListener("change", onReduceChange);

    const screenIO = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    screenIO.observe(hero);

    const accentMO = new MutationObserver(() => {
      readAccent();
      if (reduceMQ.matches) draw();
    });
    accentMO.observe(root, { attributes: true, attributeFilter: ["class", "style"] });

    readAccent();
    build();
    if (reduceMQ.matches) draw();
    else start();

    return () => {
      stop();
      if (resizeT) clearTimeout(resizeT);
      window.removeEventListener("resize", onResize);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMQ.removeEventListener("change", onReduceChange);
      screenIO.disconnect();
      accentMO.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-net" aria-hidden />;
}
