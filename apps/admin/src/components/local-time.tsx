"use client";

import { useEffect, useState } from "react";

type Props = {
  /** ISO-8601, as the server rendered it. */
  value: string;
  className?: string;
};

const FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/**
 * A timestamp in the reader's own time zone.
 *
 * Server components render on a machine set to UTC, so "06:47" on this page was
 * six hours from when the mail actually landed for anyone reading it. Formatting
 * on the server in the reader's zone is not possible — it is not in the request.
 *
 * So: UTC on the server, corrected on mount. The swap is a few characters in a
 * caption, and the alternative is a number that is quietly wrong. The `title`
 * carries the full date for anyone who needs it exactly.
 */
export function LocalTime({ value, className }: Props) {
  const [local, setLocal] = useState<{ label: string; title: string } | null>(null);

  useEffect(() => {
    const date = new Date(value);
    setLocal({
      label: date.toLocaleString(undefined, FORMAT),
      title: date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" }),
    });
  }, [value]);

  return (
    <time dateTime={value} className={className} title={local?.title} suppressHydrationWarning>
      {local?.label ??
        `${new Date(value).toLocaleString("en-US", { ...FORMAT, timeZone: "UTC" })} UTC`}
    </time>
  );
}
