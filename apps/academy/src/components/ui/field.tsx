import { cn } from "@byteveda/utils";
import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  /** Set for a native control. */
  htmlFor?: string;
  /** Set instead of `htmlFor` for a custom widget, which points back with `aria-labelledby`. */
  labelId?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, labelId, hint, className, children }: FieldProps) {
  return (
    <div className={cn("field", className)}>
      {/* A custom widget has no `htmlFor` target; it points back with `aria-labelledby`. */}
      <label id={labelId} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
