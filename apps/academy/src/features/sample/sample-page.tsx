"use client";

import { Hourglass } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Field, TextInput } from "@/components/ui";
import type { CartItem } from "@/lib/orders/model";
import { isValidEmail } from "@/lib/orders/model";
import { TURNAROUND } from "@/lib/site";
import { useSamples } from "./store";

type Placed = { reference: string; email: string };

/**
 * Ask for the sheets, rather than buy them.
 *
 * Buying is not open yet, so this page is not a checkout: it collects the
 * chapters someone wants to look at and the address to send them to. No rupee
 * figure appears anywhere on it — the inventory is a price list, but a number
 * printed beside something being given away reads as a bill, and a total under
 * a button that takes no payment reads as a broken one.
 */
export function SamplePage() {
  const { entries, rows, ready, remove, clear } = useSamples();
  const emailId = useId();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);

  async function submit() {
    setSending(true);
    setError(null);

    const items: CartItem[] = entries.map((entry) =>
      entry.kind === "chapter"
        ? { kind: "chapter", chapterId: entry.chapterId }
        : { kind: "custom", request: entry.request },
    );

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, items }),
      });
      const payload = (await response.json().catch(() => null)) as {
        reference?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.reference) {
        setError(payload?.error ?? "We could not send that. Try again in a minute.");
        return;
      }

      setPlaced({ reference: payload.reference, email });
      clear();
    } catch {
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
            The samples are on their way to <span className="reference">{placed.email}</span> —
            print-ready, answer key included, within {TURNAROUND}. Reply to that email to ask for a
            different chapter, or to tell us the format needs changing.
          </p>
          <Link className="btn btn-primary" href="/#inventory">
            Back to the inventory <span className="arr">→</span>
          </Link>
        </div>
      </>
    );
  }

  // The heading is the same in all three states on purpose. The saved list is
  // only read after mount, and a heading that changes a frame later reads as a
  // page that loaded wrong.
  const head = (
    <>
      <p className="kicker">Samples</p>
      <h1 className="display">Request samples.</h1>
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

  if (rows.length === 0) {
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
        A sample sheet for each, with its answer key, emailed within {TURNAROUND}. Free — see the
        format before you commit to anything.
      </p>

      <div className="sample-lines">
        {rows.map((row) => (
          <div className="sample-line" key={row.key}>
            <div style={{ minWidth: 0 }}>
              <b>{row.line.title}</b>
              <span>{row.line.meta}</span>
            </div>
            <div className="sample-line-right">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => remove(row.key)}
                aria-label={`Remove ${row.line.title}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <Field
        label="Email for the samples"
        htmlFor={emailId}
        hint="The sample sheets and their answer keys go to this address."
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
            ? `Request ${rows.length === 1 ? "this sample" : `these ${rows.length} samples`}`
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
          Buying full chapter packs is coming soon. Samples are free and nothing is charged today —
          when ordering opens we will mail everyone who asked for one.
        </span>
      </p>

      <p className="sample-back">
        <Link href="/#inventory">← Keep browsing the inventory</Link>
      </p>
    </>
  );
}
