type Props = {
  /** Oldest first. `null` is a day with no recorded row, not a zero. */
  values: (number | null)[];
  width?: number;
  height?: number;
  label: string;
};

/**
 * A trend, not a chart.
 *
 * No axes, no legend, no tooltip: the exact figure is printed immediately to
 * its right, so this only has to answer "up or down, and how steadily". Gaps in
 * the data break the line rather than dropping it to the baseline — a missing
 * day and a day with no downloads are different facts.
 */
export function Sparkline({ values, width = 84, height = 20, label }: Props) {
  const recorded = values.filter((value): value is number => value !== null);
  if (recorded.length < 2) return <span className="spark-empty">—</span>;

  const max = Math.max(...recorded);
  const min = Math.min(...recorded);
  // A flat series would divide by zero; draw it down the middle instead.
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  // Half the stroke, so the extremes are not clipped by the viewBox.
  const inset = 1;
  const plot = height - inset * 2;

  const pointAt = (value: number, index: number) => ({
    x: index * step,
    y: inset + plot - ((value - min) / span) * plot,
  });

  // One `M` per run of consecutive recorded days; a gap starts a new run.
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const { x, y } = pointAt(value, index);
    current.push(`${current.length === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  const lastIndex = values.findLastIndex((value) => value !== null);
  const last = lastIndex >= 0 ? pointAt(values[lastIndex] as number, lastIndex) : null;

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {segments.map((segment) => (
        <path
          key={segment}
          d={segment}
          fill="none"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {last && <circle cx={last.x} cy={last.y} r={1.8} />}
    </svg>
  );
}
