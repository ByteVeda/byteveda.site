"use client";

import type { Broadcast, Subscriber } from "@byteveda/db";
import { Mail, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteBroadcast, saveBroadcast, sendBroadcast } from "@/lib/broadcasts/actions";
import { ago } from "@/lib/format";
import { addSubscriber, removeSubscriber, resendConfirmation } from "@/lib/subscribers/actions";

type Message = { text: string; ok: boolean } | null;

function Note({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className="save-state" data-tone={message.ok ? "ok" : "error"} style={{ marginTop: 10 }}>
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
      <div className="add-package" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
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
          <span className="hint">
            They still receive a confirmation link — being typed in here is not consent.
          </span>
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
      <Note message={message} />
    </>
  );
}

export function SubscriberRowActions({ subscriber }: { subscriber: Subscriber }) {
  const [pending, startTransition] = useTransition();

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
        onClick={() => {
          if (!window.confirm(`Remove ${subscriber.email}?`)) return;
          startTransition(() => removeSubscriber(subscriber.id).then(() => undefined));
        }}
      >
        <Trash2 width={13} height={13} aria-hidden />
      </button>
    </span>
  );
}

export function BroadcastComposer({
  broadcasts,
  activeCount,
}: {
  broadcasts: Broadcast[];
  activeCount: number;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  function compose(send: boolean) {
    startTransition(async () => {
      const saved = await saveBroadcast({ subject, bodyMarkdown: body });
      if (!saved.ok || !saved.id) {
        setMessage({ text: saved.message, ok: false });
        return;
      }

      if (!send) {
        setMessage({ text: "Saved as a draft.", ok: true });
        setSubject("");
        setBody("");
        return;
      }

      const result = await sendBroadcast(saved.id);
      setMessage({ text: result.message, ok: result.ok });
      if (result.ok) {
        setSubject("");
        setBody("");
      }
    });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Broadcast</h2>
        <span className="sub" style={{ color: "var(--text-faint)", fontSize: "0.78rem" }}>
          {activeCount} confirmed subscriber{activeCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="panel-body">
        <div className="field">
          <label htmlFor="broadcast-subject">Subject</label>
          <input
            id="broadcast-subject"
            className="input"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="broadcast-body">Message</label>
          <textarea
            id="broadcast-body"
            className="textarea"
            rows={7}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Markdown. An unsubscribe link is added to every copy."
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="abtn abtn-quiet"
            onClick={() => compose(false)}
            disabled={pending || !subject.trim()}
          >
            Save draft
          </button>
          <button
            type="button"
            className="abtn abtn-primary"
            onClick={() => {
              if (!window.confirm(`Send "${subject}" to ${activeCount} subscribers?`)) return;
              compose(true);
            }}
            disabled={pending || !subject.trim() || activeCount === 0}
          >
            <Send aria-hidden />
            {pending ? "Sending…" : "Send now"}
          </button>
        </div>

        <Note message={message} />

        {broadcasts.length > 0 && (
          <div className="rows" style={{ marginTop: 18 }}>
            {broadcasts.map((broadcast) => (
              <BroadcastRow key={broadcast.id} broadcast={broadcast} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BroadcastRow({ broadcast }: { broadcast: Broadcast }) {
  const [pending, startTransition] = useTransition();
  const sent = broadcast.status === "sent";

  return (
    <div className="row" style={{ gridTemplateColumns: "80px minmax(0,1fr) 70px 28px" }}>
      <span className={`state state-${sent ? "published" : "draft"}`}>{broadcast.status}</span>
      <span className="row-title">
        {broadcast.subject}
        {sent && (
          <span className="row-sub">
            {broadcast.recipientCount} recipient{broadcast.recipientCount === 1 ? "" : "s"}
          </span>
        )}
      </span>
      <span className="num num-dim">{ago(broadcast.sentAt ?? broadcast.createdAt)}</span>
      {sent ? (
        <span />
      ) : (
        <button
          type="button"
          className="tape-remove"
          aria-label={`Delete ${broadcast.subject}`}
          disabled={pending}
          onClick={() => startTransition(() => deleteBroadcast(broadcast.id).then(() => undefined))}
        >
          <Trash2 width={13} height={13} aria-hidden />
        </button>
      )}
    </div>
  );
}
