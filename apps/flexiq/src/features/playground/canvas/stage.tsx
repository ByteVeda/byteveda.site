"use client";

import type { Engine } from "@byteveda/flexiq-sim";
import { useEffect, useRef } from "react";
import { Renderer } from "./renderer";

interface Props {
  subscribe: (cb: (engine: Engine) => void) => () => void;
  reducedMotion: boolean;
}

/**
 * Owns the canvas element and nothing else: it draws whatever the engine says
 * on each frame, and stops drawing the moment it scrolls out of view.
 *
 * Skipping a draw is all it does. The simulation's clock is gated on the whole
 * playground being visible, not on the canvas, so scrolling down to the
 * controls doesn't freeze the counters and tables still on screen.
 */
export function Stage({ subscribe, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new Renderer(canvas, reducedMotion);
    rendererRef.current = renderer;
    renderer.resize();

    let onScreen = true;
    const unsubscribe = subscribe((engine: Engine) => {
      if (!onScreen) return;
      renderer.draw(engine.snapshot());
    });

    const resizeObserver = new ResizeObserver(() => renderer.resize());
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);

    // next-themes swaps `data-theme` on <html>; the canvas has no cascade to
    // follow, so it re-reads the tokens itself.
    const themeObserver = new MutationObserver(() => renderer.refreshTheme());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      rendererRef.current = null;
    };
  }, [subscribe, reducedMotion]);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="pg-canvas"
      role="img"
      aria-label="Live view of the simulated queue, scheduler, worker pool and dead-letter queue"
    />
  );
}
