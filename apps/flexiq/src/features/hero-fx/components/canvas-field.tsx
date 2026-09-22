"use client";

import { useEffect, useRef } from "react";
import { hash01 } from "./scatter";
import { accentColor } from "./tier";

const COUNT = 220;

interface Dot {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
}

/**
 * The fallback tier, and the tier that paints first on every device: the same
 * drifting job field in 2D, at a fraction of the cost of the shader.
 */
export function CanvasField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let dots: Dot[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = Array.from({ length: COUNT }, (_, i) => ({
        x: hash01(i, "x") * width,
        y: hash01(i, "y") * height,
        speed: 6 + hash01(i, "speed") * 22,
        size: 0.7 + hash01(i, "size") * 1.6,
        alpha: 0.1 + hash01(i, "alpha") * 0.4,
      }));
    };

    let color = accentColor();
    const themeObserver = new MutationObserver(() => {
      color = accentColor();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let frame = 0;
    let last = performance.now();
    let visible = true;
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      if (!visible || document.hidden) return;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      for (const dot of dots) {
        dot.x += dot.speed * dt;
        if (dot.x > width + 4) dot.x = -4;
        ctx.globalAlpha = dot.alpha;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="hero-fx" aria-hidden />;
}
