"use client";

import { Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm";
import { deleteThread, replyToThread } from "@/lib/inbox/actions";

type Props = { threadKey: string; to: string; canSend: boolean };

export function ReplyBox({ threadKey, to, canSend }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await replyToThread(threadKey, body);
      setMessage({ text: result.message, ok: result.ok });
      if (result.ok) {
        setBody("");
        router.refresh();
      }
    });
  }

  async function remove() {
    const go = await confirm({
      title: "Delete this conversation?",
      body: `Every message from ${to} in this thread is removed. It cannot be recovered.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!go) return;

    startTransition(async () => {
      await deleteThread(threadKey);
      router.push("/inbox");
      router.refresh();
    });
  }

  return (
    <div className="reply-box">
      {!canSend && (
        <div className="notice notice-warn block-gap-sm">
          <span>RESEND_API_KEY is not set, so replies cannot send yet.</span>
        </div>
      )}

      <textarea
        className="textarea"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={`Reply to ${to}`}
        aria-label={`Reply to ${to}`}
      />

      <div className="reply-actions">
        <button
          type="button"
          className="abtn abtn-primary"
          onClick={send}
          disabled={pending || !body.trim() || !canSend}
        >
          <Send aria-hidden />
          {pending ? "Sending…" : "Send reply"}
        </button>

        <button type="button" className="abtn abtn-danger" onClick={remove} disabled={pending}>
          <Trash2 aria-hidden />
          Delete
        </button>

        {message && (
          <span className="save-state" data-tone={message.ok ? "ok" : "error"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
