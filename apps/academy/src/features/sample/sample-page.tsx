"use client";

import { track } from "@byteveda/analytics/vercel";
import { Hourglass } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Field, TextInput } from "@/components/ui";
import { isValidEmail } from "@/lib/orders/model";
import { TURNAROUND } from "@/lib/site";
import { useSamples } from "./store";

type Placed = { reference: string; email: string };

/**
 * Ask for the sheet, rather than buy it.
 *
 * Buying is not open yet, so this page is not a checkout: it collects the one
 * chapter someone wants to look at and the address to send it to. No rupee
 * figure appears anywhere on it — the inventory is a price list, but a number
 * printed beside something being given away reads as a bill, and a total under
 * a button that takes no payment reads as a broken one.
 */
export function SamplePage() {
  const { item, line, ready, clear } = useSamples();
  const emailId = useId();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);

  async function submit() {
    if (!item) return;

    setSending(true);
    setError(null);

    // Measured here rather than on the server, because this is the wait the
    // person actually sat through: their network, the cold start and both round
    // trips the route makes, which the function's own timing cannot see.
    const started = performance.now();
    const took = () => Math.round(performance.now() - started);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, items: [item] }),
      });
      const payload = (await response.json().catch(() => null)) as {
        reference?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.reference) {
        track("sample_failed", { kind: item.kind, status: response.status, ms: took() });
        setError(payload?.error ?? "We could not send that. Try again in a minute.");
        return;
      }

      track("sample_requested", { kind: item.kind, ms: took() });
      setPlaced({ reference: payload.reference, email });
      clear();
    } catch {
      // No status: the request never came back, so there is nothing to report
      // but how long it took to give up.
      track("sample_failed", { kind: item.kind, status: 0, ms: took() });
      setError("That did not reach us. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (placed) {
    return (
      <>
        <p className="kicker">Request received</p>
        <h1 className="display">Reference {placed.reference}</h1>
        <div className="placed">
          <p>
            The sample is on its way to <span className="reference">{placed.email}</span> —
            print-ready, answer key included, within {TURNAROUND}. Reply to that email if the format
            needs changing.
          </p>
          <Link className="btn btn-primary" href="/#inventory">
            Back to the inventory <span className="arr">→</span>
          </Link>
        </div>
      </>
    );
  }

  // The heading is the same in all three states on purpose. The saved pick is
  // only read after mount, and a heading that changes a frame later reads as a
  // page that loaded wrong.
  const head = (
    <>
      <p className="kicker">Sample</p>
      <h1 className="display">Request your sample.</h1>
    </>
  );

  if (!ready) {
    return (
      <>
        {head}
        <div className="sample-waiting" aria-hidden />
      </>
    );
  }

  if (!line) {
    return (
      <>
        {head}
        <div className="placed">
          <p>
            Nothing picked yet. Choose a chapter from the inventory, or describe one we don&rsquo;t
            stock — both end up back here.
          </p>
          <Link className="btn btn-primary" href="/#inventory">
            Browse the inventory <span className="arr">→</span>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {head}
      <p className="sample-sub">
        One sheet, with its answer key, emailed within {TURNAROUND}. Free — see the format before
        you commit to anything.
      </p>

      <div className="sample-lines">
        <div className="sample-line">
          <div style={{ minWidth: 0 }}>
            <b>{line.title}</b>
            <span>{line.meta}</span>
          </div>
          <div className="sample-line-right">
            <Link className="btn btn-ghost" href="/#inventory">
              Change
            </Link>
          </div>
        </div>
      </div>

      <Field
        label="Email for the sample"
        htmlFor={emailId}
        hint="One free sample per address. The sheet and its answer key go here."
        className="mt-6"
      >
        <TextInput
          id={emailId}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <button
        type="button"
        className="btn btn-primary mt-5 w-full"
        disabled={!isValidEmail(email) || sending}
        onClick={submit}
      >
        {sending
          ? "Sending…"
          : isValidEmail(email)
            ? "Request this sample"
            : "Add an email to send"}
      </button>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="soon">
        <Hourglass size={16} aria-hidden />
        <span>
          Buying full chapter packs is coming soon. The sample is free and nothing is charged today
          — when ordering opens we will mail everyone who asked for one.
        </span>
      </p>

      <p className="sample-back">
        <Link href="/#inventory">← Keep browsing the inventory</Link>
      </p>
    </>
  );
}
