import { cn, ORG } from "@byteveda/utils";
import Link from "next/link";

type WordmarkProps = {
  href?: string;
  /** Brand text; defaults to the org name, lowercased. */
  label?: string;
  className?: string;
};

/** The ByteVeda brand lockup — teal bracket mark + wordmark. */
export function Wordmark({ href = "/", label = ORG.toLowerCase(), className }: WordmarkProps) {
  return (
    <Link href={href} className={cn("brand", className)} aria-label={`${ORG} home`}>
      <span className="mark" aria-hidden>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>{ORG}</title>
          <path d="M5 7h9a4 4 0 0 1 0 8H9l5 6" />
          <path d="M9 3v18" />
        </svg>
      </span>
      <span>
        <b>{label}</b>
        <span className="dot">.</span>
      </span>
    </Link>
  );
}
