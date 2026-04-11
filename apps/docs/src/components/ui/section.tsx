import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = HTMLAttributes<HTMLElement> & {
  id?: string;
  containerClassName?: string;
  children: ReactNode;
  bordered?: boolean;
};

export function Section({
  id,
  className,
  containerClassName,
  children,
  bordered = true,
  ...props
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-16", bordered && "border-border border-b", className)}
      {...props}
    >
      <div className={cn("mx-auto max-w-6xl px-6 py-24 md:py-32", containerClassName)}>
        {children}
      </div>
    </section>
  );
}

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "split";
  descriptionClassName?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  descriptionClassName,
}: SectionHeaderProps) {
  if (align === "split") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && (
            <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-2 font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
            {title}
          </h2>
        </div>
        {description && (
          <p className={cn("max-w-sm text-muted-foreground text-sm", descriptionClassName)}>
            {description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {eyebrow && (
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 font-semibold text-3xl text-foreground tracking-tight md:text-4xl">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-6 max-w-2xl text-base text-muted-foreground leading-7",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
