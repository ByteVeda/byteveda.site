const CORES = [
  { label: "Rust", x: 100 },
  { label: "C++", x: 191 },
  { label: "Go", x: 282 },
  { label: "Python", x: 373 },
] as const;

const CHIP_Y = 150;
const CHIP_W = 74;
const CHIP_H = 52;
const BASE_Y = 318;
const CHIP_TOP = CHIP_Y + CHIP_H; // 202

/**
 * "Right core per problem, one standard." Different language cores drop pulses
 * down into a shared baseline. Accent comes from `currentColor` (the
 * `.engine-stage` sets `color: var(--accent)`), so it tracks the theme.
 * Animations are pure SMIL and pause under `prefers-reduced-motion` via the
 * global stylesheet's marquee/aurora rules being independent — SMIL itself is
 * left running but is decorative.
 */
export function EngineDiagram() {
  return (
    <svg
      viewBox="0 0 460 440"
      fill="none"
      role="img"
      aria-label="Different language cores held to one ByteVeda standard"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <title>Different language cores held to one ByteVeda standard</title>

      <text
        x="237"
        y="96"
        textAnchor="middle"
        fontSize="11"
        style={{ fill: "var(--text-faint)", letterSpacing: "2px" }}
      >
        RIGHT CORE PER PROBLEM
      </text>

      {/* the standard (baseline) */}
      <line
        x1="58"
        y1={BASE_Y}
        x2="416"
        y2={BASE_Y}
        stroke="currentColor"
        strokeWidth={7}
        strokeOpacity={0.16}
        strokeLinecap="round"
      />
      <line
        x1="58"
        y1={BASE_Y}
        x2="416"
        y2={BASE_Y}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {CORES.map((c, i) => {
        const lx = c.x - CHIP_W / 2;
        const connectorDur = `${1.4 + i * 0.18}s`;
        const pulseDur = `${1.8 + i * 0.22}s`;
        return (
          <g key={c.label}>
            {/* connector to baseline */}
            <line
              x1={c.x}
              y1={CHIP_TOP}
              x2={c.x}
              y2={BASE_Y}
              stroke="currentColor"
              strokeWidth={1.2}
              strokeOpacity={0.4}
              strokeDasharray="3 4"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="14"
                to="0"
                dur={connectorDur}
                repeatCount="indefinite"
              />
            </line>

            {/* pulse travelling down into the standard */}
            <circle r="3" fill="currentColor">
              <animateMotion
                path={`M${c.x} ${CHIP_TOP} L${c.x} ${BASE_Y}`}
                dur={pulseDur}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur={pulseDur}
                repeatCount="indefinite"
              />
            </circle>

            {/* chip body */}
            <rect
              x={lx}
              y={CHIP_Y}
              width={CHIP_W}
              height={CHIP_H}
              rx={10}
              style={{ fill: "var(--surface-2)", stroke: "var(--line)" }}
              strokeWidth={1}
            />

            {/* chip legs */}
            <g stroke="currentColor" strokeWidth={1.4} strokeOpacity={0.45} strokeLinecap="round">
              <line x1={lx - 5} y1={CHIP_Y + 17} x2={lx} y2={CHIP_Y + 17} />
              <line x1={lx - 5} y1={CHIP_Y + 35} x2={lx} y2={CHIP_Y + 35} />
              <line x1={lx + CHIP_W} y1={CHIP_Y + 17} x2={lx + CHIP_W + 5} y2={CHIP_Y + 17} />
              <line x1={lx + CHIP_W} y1={CHIP_Y + 35} x2={lx + CHIP_W + 5} y2={CHIP_Y + 35} />
            </g>

            <text
              x={c.x}
              y={CHIP_Y + CHIP_H / 2 + 4}
              textAnchor="middle"
              fontSize="12.5"
              style={{ fill: "var(--text)" }}
            >
              {c.label}
            </text>
          </g>
        );
      })}

      {/* standard label */}
      <text
        x="237"
        y={BASE_Y + 30}
        textAnchor="middle"
        fontSize="10.5"
        fill="currentColor"
        style={{ letterSpacing: "2.5px" }}
      >
        THE BYTEVEDA STANDARD
      </text>

      {/* pulse running along the standard */}
      <circle r="3.5" fill="currentColor">
        <animateMotion path={`M58 ${BASE_Y} L416 ${BASE_Y}`} dur="3.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
