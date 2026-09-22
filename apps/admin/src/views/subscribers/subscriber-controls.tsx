"use client";

import type { Broadcast, Subscriber } from "@byteveda/db";
import { Mail, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { type AttachedFile, AttachmentPicker, useConfirm } from "@/components";
import { deleteBroadcast, saveBroadcast, sendBroadcast } from "@/lib/broadcasts/actions";
import { ago } from "@/lib/format";
import { addSubscriber, removeSubscriber, resendConfirmation } from "@/lib/subscribers/actions";

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

export function BroadcastComposer({
  broadcasts,
  activeCount,
  maxFileBytes,
}: {
  broadcasts: Broadcast[];
  activeCount: number;
  /** The per-file ceiling as the server resolves it. See `lib/email/attachments.ts`. */
  maxFileBytes: number;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  /**
   * The draft this composer is writing, once it has one.
   *
   * A file has to be attached to something, and until the draft is saved there
   * is nothing to attach it to — so the first attachment saves the draft and
   * keeps its id. Everything after that is an edit of the same row.
   */
  const [draftId, setDraftId] = useState<string | null>(null);

  /** Saves what is typed and returns the draft's id, creating one if needed. */
  async function persist(): Promise<string | null> {
    const saved = await saveBroadcast({
      id: draftId ?? undefined,
      subject,
      bodyMarkdown: body,
    });

    if (!saved.ok || !saved.id) {
      setMessage({ text: saved.message, ok: false });
      return null;
    }

    setDraftId(saved.id);
    return saved.id;
  }

  function clear() {
    setSubject("");
    setBody("");
    setFiles([]);
    setDraftId(null);
  }

  function compose(send: boolean) {
    startTransition(async () => {
      const id = await persist();
      if (!id) return;

      if (!send) {
        setMessage({ text: "Saved as a draft.", ok: true });
        // The draft keeps its id and its files — a saved draft is something to
        // come back to, and clearing the composer would strand both.
        return;
      }

      const result = await sendBroadcast(id);
      setMessage({ text: result.message, ok: result.ok });
      if (result.ok) clear();
    });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Broadcast</h2>
        <span className="meta">
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

        <AttachmentPicker
          kind="broadcast"
          owner={draftId}
          files={files}
          onChange={setFiles}
          onNeedOwner={persist}
          maxFileBytes={maxFileBytes}
          bodyBytes={body.length}
          disabled={pending || !subject.trim()}
        />

        <div className="btn-row">
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
            onClick={async () => {
              const go = await confirm({
                title: `Send to ${activeCount} subscriber${activeCount === 1 ? "" : "s"}?`,
                body:
                  files.length > 0
                    ? // Worth saying: a broadcast is one send per recipient, so
                      // an attachment is sent that many times, and Resend's
                      // five-a-second rate limit paces the whole run.
                      `"${subject}" goes out immediately, with ${files.length} file${files.length === 1 ? "" : "s"} attached to every copy. A sent broadcast cannot be recalled.`
                    : `"${subject}" goes out immediately. A sent broadcast cannot be recalled.`,
                confirmLabel: "Send now",
              });
              if (go) compose(true);
            }}
            disabled={pending || !subject.trim() || activeCount === 0}
          >
            <Send aria-hidden />
            {pending ? "Sending…" : "Send now"}
          </button>
        </div>

        <Note message={message} />

        {broadcasts.length > 0 && (
          <div className="rows stack-top">
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
    <div className="row row-broadcast">
      <span className={`state state-${sent ? "published" : "draft"}`}>{broadcast.status}</span>
      <span className="row-title">
        {broadcast.subject}
        {sent && (
          <span className="row-sub">
            {broadcast.recipientCount} recipient{broadcast.recipientCount === 1 ? "" : "s"}
          </span>
        )}
      </span>
      {/* `ago` reads the clock, so a value sitting on a boundary can render
          "just now" on the server and "1m" a moment later on the client. */}
      <span className="num num-dim" suppressHydrationWarning>
        {ago(broadcast.sentAt ?? broadcast.createdAt)}
      </span>
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
