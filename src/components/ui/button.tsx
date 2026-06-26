import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { isExternalUrl } from "@/lib/url";

type Variant = "primary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "btn btn-primary",
  ghost: "btn btn-ghost",
};

type CommonProps = {
  variant?: Variant;
  /** Trailing arrow glyph rendered in a `.arr` span (animates on hover). */
  arrow?: "→" | "↗";
  className?: string;
  children?: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | "href"> & {
    href: string;
    external?: boolean;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const { variant = "primary", arrow, className, children, ...rest } = props;
  const classes = cn(variants[variant], className);

  const label = (
    <>
      {children}
      {arrow && <span className="arr">{arrow}</span>}
    </>
  );

  if ("href" in rest && rest.href !== undefined) {
    const { href, external, ...anchorRest } = rest;
    const openInNewTab = external === true || isExternalUrl(href);

    if (isExternalUrl(href)) {
      return (
        <a
          href={href}
          target={openInNewTab ? "_blank" : undefined}
          rel={openInNewTab ? "noopener noreferrer" : undefined}
          className={classes}
          {...anchorRest}
        >
          {label}
        </a>
      );
    }

    return (
      <Link href={href} className={classes} {...anchorRest}>
        {label}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {label}
    </button>
  );
}
