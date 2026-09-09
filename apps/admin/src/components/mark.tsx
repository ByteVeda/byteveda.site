/** The ByteVeda bracket glyph, matching the wordmark on the public sites. */
export function Mark({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 7h9a4 4 0 0 1 0 8H9l5 6" />
      <path d="M9 3v18" />
    </svg>
  );
}
