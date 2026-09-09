"use client";

import { useState } from "react";

export type Action = "confirm" | "unsubscribe";

type Props = {
  token: string;
  action: Action;
  /** Shown on the button before anything has happened. */
  label: string;
};

const HEADING: Record<Action, string> = {
  confirm: "Subscribed",
  unsubscribe: "Unsubscribed",
};

/**
 * The button behind an emailed link.
 *
 * The page has already read the token's state and only renders this when the
 * action still applies, so pressing it is always meaningful. Pressing it twice
 * is not an error either — the server reports the settled state and this shows
 * that instead.
 */
export function SubscriptionAction({ token, action, label }: Props) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function run() {
    setPending(true);
    try {
      const response = await fetch("/api/public/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; error?: string };

      setResult({
        ok: response.ok && body.ok !== false,
        message: body.message ?? body.error ?? "That did not work. Try the link again.",
      });
    } catch {
      setResult({ ok: false, message: "Could not reach the server. Try again in a moment." });
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <>
        <h1>{result.ok ? HEADING[action] : "That did not work"}</h1>
        <p>{result.message}</p>
        <a className="abtn abtn-quiet" href="https://byteveda.org">
          Go to byteveda.org
        </a>
      </>
    );
  }

  return (
    <button type="button" className="abtn abtn-primary" onClick={run} disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}
