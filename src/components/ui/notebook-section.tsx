import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type NotebookSectionProps = HTMLAttributes<HTMLElement> & {
  id?: string;
  index: string;
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  figure?: ReactNode;
  divider?: boolean;
  bordered?: boolean;
  containerClassName?: string;
  children?: ReactNode;
};

export function NotebookSection({
  id,
  index,
  eyebrow,
  title,
  subtitle,
  description,
  figure,
  divider = true,
  bordered = true,
  className,
  containerClassName,
  children,
  ...rest
}: NotebookSectionProps) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-16", bordered && "border-border border-b", className)}
      {...rest}
    >
      <div
        className={cn(
          "mx-auto max-w-5xl px-6 py-20 md:px-10 md:py-24",
          containerClassName,
        )}
      >
        <header className="flex items-start justify-between gap-10">
          <div className="min-w-0 flex-1">
            <p className="notebook-mono flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              <span>§ {index}</span>
              <span aria-hidden>·</span>
              <span>{eyebrow}</span>
            </p>

            <h2 className="notebook-headline mt-6 font-medium text-4xl text-foreground leading-[1.05] md:text-5xl">
              {title}
            </h2>

            {subtitle && (
              <p className="notebook-serif mt-5 flex items-baseline gap-3 text-[15px] text-muted-foreground italic">
                <span aria-hidden className="text-muted-foreground/60">
                  ───
                </span>
                {subtitle}
              </p>
            )}

            {description && (
              <p className="notebook-serif mt-8 max-w-2xl text-[17px] text-foreground/85 leading-[1.7]">
                {description}
              </p>
            )}
          </div>
          {figure}
        </header>

        {(divider || children) && (
          <>
            {divider && <hr className="mt-12 border-border" aria-hidden />}
            {children && <div className={cn(divider ? "mt-12" : "mt-14")}>{children}</div>}
          </>
        )}
      </div>
    </section>
  );
}
