type RelativeTimeProps = {
  value: string;
  className?: string;
};

const UNITS: { limit: number; divisor: number; label: string }[] = [
  { limit: 60, divisor: 1, label: "s" },
  { limit: 3600, divisor: 60, label: "m" },
  { limit: 86400, divisor: 3600, label: "h" },
  { limit: 604800, divisor: 86400, label: "d" },
  { limit: 2629800, divisor: 604800, label: "w" },
  { limit: 31557600, divisor: 2629800, label: "mo" },
];

function format(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
  for (const { limit, divisor, label } of UNITS) {
    if (diff < limit) return `${Math.max(1, Math.floor(diff / divisor))}${label} ago`;
  }
  return `${Math.floor(diff / 31557600)}y ago`;
}

export function RelativeTime({ value, className }: RelativeTimeProps) {
  const iso = new Date(value).toISOString();
  return (
    <time dateTime={iso} className={className} title={new Date(value).toLocaleString()}>
      {format(value)}
    </time>
  );
}
