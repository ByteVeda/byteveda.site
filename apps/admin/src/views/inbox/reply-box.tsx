"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { type AttachedFile, AttachmentPicker } from "@/components";
import { replyToThread } from "@/lib/inbox/actions";

type Props = {
  threadKey: string;
  to: string;
  /** The mailbox they wrote to, which is the one this answers from. */
  from: string;
  canSend: boolean;
  /** Files already staged against this conversation, from an earlier visit. */
  attachments: AttachedFile[];
  /** The per-file ceiling as the server resolves it. See `lib/email/attachments.ts`. */
  maxFileBytes: number;
};

/** Where an unsent reply waits. One entry per conversation. */
const draftKey = (threadKey: string) => `bv:inbox:draft:${threadKey}`;

/** ⌘ on a Mac, Ctrl everywhere else. The other modifiers must not send. */
function isSendChord(event: React.KeyboardEvent): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

export function ReplyBox({ threadKey, to, from, canSend, attachments, maxFileBytes }: Props) {
  const router = useRouter();
  const field = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>(attachments);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Switching conversations clears the box in the same render that changes it.
   *
   * In an effect this shows the previous conversation's draft for a frame, over
   * the new correspondent's name — which is the one moment where a half-written
   * reply looks like it is about to go to the wrong person.
   */
  const [openThread, setOpenThread] = useState(threadKey);
  const [restored, setRestored] = useState(false);
  if (openThread !== threadKey) {
    setOpenThread(threadKey);
    setBody("");
    // The files come from the server for whichever conversation is open, so
    // this takes the new ones rather than clearing: an attachment is staged in
    // Postgres, and it is still there when the conversation is opened again.
    setFiles(attachments);
    setRestored(false);
    setResult(null);
  }

  /**
   * A half-written reply survives clicking onto another conversation, the back
   * button, and a reload.
   *
   * `localStorage` rather than the server: a draft is not worth a round trip to
   * Tokyo on every keystroke, and it is only ever wanted by the browser that
   * was typing it.
   */
  useEffect(() => {
    setBody(window.localStorage.getItem(draftKey(threadKey)) ?? "");
    setRestored(true);
  }, [threadKey]);

  useEffect(() => {
    if (!restored) return;

    if (body) window.localStorage.setItem(draftKey(threadKey), body);
    else window.localStorage.removeItem(draftKey(threadKey));
  }, [body, threadKey, restored]);

  function send() {
    startTransition(async () => {
      const sent = await replyToThread(threadKey, body);
      setResult({ text: sent.message, ok: sent.ok });

      if (sent.ok) {
        // Only on success: a failed send leaves the words where they are, so
        // the retry is the same button rather than typing it again. The files
        // behave the same way — they stay staged until something goes out.
        window.localStorage.removeItem(draftKey(threadKey));
        setBody("");
        setFiles([]);
        router.refresh();
      }
    });
  }

  // A file with no covering note is a reply; so is a note with no file. Only
  // the empty message is not.
  const sendable = canSend && (body.trim().length > 0 || files.length > 0);

  return (
    <div className="reply-box">
      <div className="reply-head">
        <h3>Reply to {to}</h3>
        {from && (
          <span>
            from <b>{from}</b>
          </span>
        )}
      </div>

      {!canSend && (
        <div className="notice notice-warn block-gap-sm">
          <span>RESEND_API_KEY is not set, so replies cannot send yet.</span>
        </div>
      )}

      <textarea
        ref={field}
        className="textarea"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (isSendChord(event) && sendable && !pending) {
            event.preventDefault();
            send();
          }
        }}
        placeholder={`Write to ${to}`}
        aria-label={`Reply to ${to}`}
      />

      <AttachmentPicker
        kind="reply"
        owner={threadKey}
        files={files}
        onChange={setFiles}
        maxFileBytes={maxFileBytes}
        bodyBytes={body.length}
        disabled={!canSend || pending}
      />

      <div className="reply-actions">
        <button
          type="button"
          className="abtn abtn-primary"
          onClick={send}
          disabled={pending || !sendable}
        >
          <Send aria-hidden />
          {pending ? "Sending…" : "Send reply"}
        </button>

        <kbd className="reply-hint">⌘↵</kbd>

        {result && (
          <span className="save-state" data-tone={result.ok ? "ok" : "error"} role="status">
            {result.text}
          </span>
        )}
      </div>
    </div>
  );
}
