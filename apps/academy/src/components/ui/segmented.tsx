"use client";

import { cn } from "@byteveda/utils";
import { useId } from "react";

export type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  labelledBy?: string;
  className?: string;
};

/**
 * A radio group that looks like pills.
 *
 * Real `<input type="radio">` elements behind the labels rather than buttons
 * with `role="radio"`: exactly one of these is always on, and the native
 * control already knows the arrow-key and roving-focus behaviour a screen
 * reader user expects from that. The inputs are hidden, not removed, so the
 * group still works with the keyboard and with forms.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  labelledBy,
  className,
}: SegmentedProps<T>) {
  const name = useId();

  return (
    <div className={cn("seg", className)} role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((option) => (
        <label className="seg-opt" key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
