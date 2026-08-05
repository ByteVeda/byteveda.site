"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Newsletter capture. There's no backend yet, so this is an optimistic,
 * self-contained confirmation (mirrors the prototype). Swap the `onSubmit`
 * body for a real endpoint when one exists.
 */
export function FooterSubscribe() {
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const id = useId();

  return (
    <form
      className={cn("footer-sub", done && "done")}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.includes("@")) return;
        setDone(true);
      }}
    >
      <label className="sr-only" htmlFor={id}>
        Email address
      </label>
      <input
        id={id}
        type="email"
        name="email"
        placeholder="you@company.com"
        required
        disabled={done}
        value={done ? "you're on the list ✓" : email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" variant="primary" arrow={done ? undefined : "→"} disabled={done}>
        {done ? "Subscribed ✓" : "Subscribe"}
      </Button>
    </form>
  );
}
