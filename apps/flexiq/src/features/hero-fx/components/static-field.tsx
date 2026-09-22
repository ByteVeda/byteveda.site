import { hash01 } from "./scatter";

/**
 * The `prefers-reduced-motion` tier: the same visual language — a field of jobs
 * draining right toward the workers — with nothing in motion.
 */
export function StaticField() {
  const dots = Array.from({ length: 90 }, (_, i) => ({
    id: i,
    cx: hash01(i, "x") * 100,
    cy: hash01(i, "y") * 100,
    r: 0.35 + hash01(i, "size") * 0.4,
    opacity: 0.15 + hash01(i, "alpha") * 0.5,
  }));

  return (
    <svg className="hero-fx" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <title>Jobs flowing toward the worker pool</title>
      {dots.map((dot) => (
        <circle
          key={dot.id}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          fill="var(--accent)"
          opacity={dot.opacity}
        />
      ))}
    </svg>
  );
}
