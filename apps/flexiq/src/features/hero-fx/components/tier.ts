export type Tier = "webgl" | "canvas" | "static";

/**
 * Which hero the visitor gets. The order is deliberate: correctness for people
 * who asked for less motion, then capability, then the shader.
 *
 * This never runs during SSR — the hero paints the canvas tier first and only
 * upgrades once this says so, so nothing here can block first paint.
 */
export function detectTier(): Tier {
  if (typeof window === "undefined") return "canvas";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";

  // A phone rendering a full-bleed particle field costs more battery than the
  // effect is worth, and the hero is the first thing that has to paint.
  if (window.matchMedia("(max-width: 860px)").matches) return "canvas";

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || memory <= 4) return "canvas";

  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) return "canvas";
  } catch {
    return "canvas";
  }

  return "webgl";
}

/** The accent colour, read from the live theme rather than hard-coded. */
export function accentColor(): string {
  if (typeof window === "undefined") return "#1f9d54";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  return value || "#1f9d54";
}
