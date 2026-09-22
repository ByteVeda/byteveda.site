"use client";

import { PenLine, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { type AttachedFile, AttachmentPicker } from "@/components";
import { composeMessage } from "@/lib/inbox/actions";
import type { SendableAddress } from "@/lib/inbox/queries";

type Props = {
  /** The addresses this operator may send as. Empty means no composer at all. */
  addresses: SendableAddress[];
  canSend: boolean;
  maxFileBytes: number;
};

/** Where an unsent message waits. One draft, because there is one composer. */
const DRAFT = "bv:inbox:compose";

/** ⌘ on a Mac, Ctrl everywhere else. The other modifiers must not send. */
function isSendChord(event: React.KeyboardEvent): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

type Draft = { id: string; from: string; to: string; subject: string; body: string };

function freshDraft(from: string): Draft {
  return { id: crypto.randomUUID(), from, to: "", subject: "", body: "" };
}

/**
 * Writing to somebody who has not written in.
 *
 * The console could only answer mail, which stops being enough the moment the
 * thing to do is send a sheet: the work order names a customer who has never
 * emailed this inbox, and reaching them meant another mail client and no
 * record of it here.
 *
 * A dialog rather than a pane, because composing is a thing you start and
 * finish rather than a place you are. What it sends opens a conversation in
 * the inbox, keyed so that the reply lands in it.
 *
 * The draft id is minted in the browser and survives a reload with the rest of
 * the draft, which is what lets a file uploaded before the address was decided
 * still belong to the message that eventually goes out.
 */
export function ComposeBox({ addresses, canSend, maxFileBytes }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  // Restored once, on first open rather than on mount: a composer nobody has
  // asked for should not be reading storage on every inbox render.
  useEffect(() => {
    if (!open || draft) return;

    const stored = window.localStorage.getItem(DRAFT);
    const restored = stored ? (JSON.parse(stored) as Partial<Draft>) : null;

    setDraft(
      restored?.id
        ? { ...freshDraft(addresses[0]?.email ?? ""), ...restored, id: restored.id }
        : freshDraft(addresses[0]?.email ?? ""),
    );
  }, [open, draft, addresses]);

  useEffect(() => {
    if (draft) window.localStorage.setItem(DRAFT, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  function edit(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function send() {
    if (!draft) return;

    startTransition(async () => {
      const sent = await composeMessage({
        from: draft.from,
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        draftId: draft.id,
      });
      setResult({ text: sent.message, ok: sent.ok });

      if (!sent.ok) return;

      // Only on success. A failed send keeps the words and the files exactly
      // where they are, so the retry is this button rather than typing it out
      // and uploading everything again.
      window.localStorage.removeItem(DRAFT);
      setDraft(null);
      setFiles([]);
      setOpen(false);
      router.refresh();
    });
  }

  // No address means no verified mailbox has ever received mail here, so there
  // is nothing this could legitimately send as.
  if (addresses.length === 0) return null;

  const sendable =
    canSend &&
    Boolean(draft?.from) &&
    Boolean(draft?.to.trim()) &&
    Boolean(draft?.subject.trim()) &&
    ((draft?.body.trim().length ?? 0) > 0 || files.length > 0);

  return (
    <>
      <button type="button" className="abtn abtn-sm" onClick={() => setOpen(true)}>
        <PenLine aria-hidden />
        Compose
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard route out is Escape, handled by onCancel; the click handler only adds pointer dismissal on the backdrop */}
      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
      >
        {open && draft && (
          <div className="dialog-card dialog-card-wide">
            <header className="dialog-head">
              <div>
                <h2 id={titleId}>New message</h2>
                <p className="dialog-sub">
                  Opens a conversation in the inbox. Their reply lands in it.
                </p>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X width={15} height={15} aria-hidden />
              </button>
            </header>

            <div className="dialog-body">
              {!canSend && (
                <div className="notice notice-warn block-gap-sm">
                  <span>RESEND_API_KEY is not set, so nothing can send yet.</span>
                </div>
              )}

              {/* From and To sit together: they are one question — which two
                  addresses. `dialog-split` is the same two-up the access
                  dialog uses. */}
              <div className="dialog-split">
                <div className="field">
                  <label htmlFor="compose-from">From</label>
                  <select
                    id="compose-from"
                    className="input"
                    value={draft.from}
                    disabled={pending}
                    onChange={(event) => edit({ from: event.target.value })}
                  >
                    {addresses.map((address) => (
                      <option key={address.email} value={address.email}>
                        {address.email}
                      </option>
                    ))}
                  </select>
                  <span className="hint">
                    Their reply comes back to this address, and the conversation belongs to it.
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="compose-to">To</label>
                  <input
                    id="compose-to"
                    className="input input-mono"
                    type="email"
                    value={draft.to}
                    placeholder="student@example.com"
                    disabled={pending}
                    onChange={(event) => edit({ to: event.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="compose-subject">Subject</label>
                <input
                  id="compose-subject"
                  className="input"
                  value={draft.subject}
                  placeholder="Your sheet — Carbon and its Compounds"
                  disabled={pending}
                  onChange={(event) => edit({ subject: event.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="compose-body">Message</label>
                <textarea
                  id="compose-body"
                  className="textarea"
                  value={draft.body}
                  placeholder="Attached is the sheet you asked for."
                  disabled={pending}
                  onChange={(event) => edit({ body: event.target.value })}
                  onKeyDown={(event) => {
                    if (isSendChord(event) && sendable && !pending) {
                      event.preventDefault();
                      send();
                    }
                  }}
                />
              </div>

              <AttachmentPicker
                kind="compose"
                owner={draft.id}
                files={files}
                onChange={setFiles}
                maxFileBytes={maxFileBytes}
                bodyBytes={draft.body.length}
                disabled={!canSend || pending}
              />
            </div>

            <div className="dialog-actions">
              {result && (
                <span
                  className="dialog-status"
                  data-tone={result.ok ? "ok" : "error"}
                  role="status"
                >
                  {result.text}
                </span>
              )}
              <kbd className="reply-hint">⌘↵</kbd>
              <button
                type="button"
                className="abtn abtn-quiet"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="abtn abtn-primary"
                onClick={send}
                disabled={pending || !sendable}
              >
                <Send aria-hidden />
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
