import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
};

/**
 * A link into the documentation.
 *
 * Docs live on a sibling ByteVeda domain rather than a third-party site, so
 * they open in the same tab — the same rule byteveda.org follows. Every docs
 * link on the site goes through here so the behaviour can't drift one anchor
 * at a time. `ExternalLink` from @byteveda/ui stays for genuinely external
 * destinations like GitHub, which do open in a new tab.
 */
export function DocsLink({ href, className, children, ...rest }: Props) {
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
