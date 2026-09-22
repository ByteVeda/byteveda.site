"use client";

import type { Subscriber } from "@byteveda/db";
import { Mail, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm";
import { addSubscriber, removeSubscriber, resendConfirmation } from "../actions";

type Message = { text: string; ok: boolean } | null;

function Note({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className="note" data-tone={message.ok ? "ok" : "error"}>
      {message.text}
    </p>
  );
}

export function AddSubscriberForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await addSubscriber(email);
      setMessage({ text: result.message, ok: result.ok });
      if (result.ok) setEmail("");
    });
  }

  return (
    <>
      <div className="form-row form-row-invite">
        <div className="field">
          <label htmlFor="add-subscriber">Add an address</label>
          <input
            id="add-subscriber"
            className="input input-mono"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder="someone@example.com"
          />
        </div>
        <button
          type="button"
          className="abtn abtn-quiet"
          onClick={submit}
          disabled={pending || !email.trim()}
        >
          {pending ? "Sending…" : "Invite"}
        </button>
      </div>
      {/* Below the row rather than inside the field: a hint in the field makes
          its column taller and drops the button past the input. */}
      <p className="form-row-hint">
        They still receive a confirmation link — being typed in here is not consent.
      </p>
      <Note message={message} />
    </>
  );
}

export function SubscriberRowActions({ subscriber }: { subscriber: Subscriber }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  return (
    <span className="row-actions">
      {subscriber.status === "pending" && (
        <button
          type="button"
          className="abtn abtn-quiet abtn-sm"
          disabled={pending}
          title="Resend the confirmation link"
          onClick={() =>
            startTransition(() => resendConfirmation(subscriber.id).then(() => undefined))
          }
        >
          <Mail aria-hidden />
        </button>
      )}
      <button
        type="button"
        className="tape-remove"
        aria-label={`Remove ${subscriber.email}`}
        disabled={pending}
        onClick={async () => {
          const go = await confirm({
            title: `Remove ${subscriber.email}?`,
            body: "They are taken off the list entirely, along with their consent record.",
            confirmLabel: "Remove",
            destructive: true,
          });
          if (!go) return;
          startTransition(() => removeSubscriber(subscriber.id).then(() => undefined));
        }}
      >
        <Trash2 width={13} height={13} aria-hidden />
      </button>
    </span>
  );
}
