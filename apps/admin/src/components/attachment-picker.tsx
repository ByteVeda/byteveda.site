"use client";

import { Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { removeAttachment } from "@/lib/attachments/actions";
import {
  checkAttachment,
  formatBytes,
  RESEND_MAX_EMAIL_BYTES,
  remainingBytes,
} from "@/lib/email/attachments";

/**
 * A file staged against a composer. Structurally what `listStaged` returns,
 * declared here so a client component never imports the database package.
 */
export type AttachedFile = {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
};

type Props = {
  /** Which composer these belong to. See `lib/attachments/store.ts`. */
  kind: "reply" | "compose" | "broadcast";
  /**
   * What the composer is attached to — a thread key, or a draft id.
   *
   * Null when the composer has nothing to attach files to yet, which only
   * happens for a broadcast that has not been saved. `onNeedOwner` is how one
   * is obtained at the moment it is first needed.
   */
  owner: string | null;
  files: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
  /** Asked for an owner id on the first upload, when there is none. */
  onNeedOwner?: () => Promise<string | null>;
  /** The per-file ceiling, resolved on the server — it can be configured there. */
  maxFileBytes: number;
  /** The message body, so the budget quoted is the one that will be checked. */
  bodyBytes?: number;
  disabled?: boolean;
};

/**
 * Attaching files to an outgoing message.
 *
 * Every file is uploaded on its own, the moment it is chosen, rather than with
 * the message. Two limits force this and neither can be argued with: Resend
 * allows 40MB per email *after Base64 encoding*, and a serverless request body
 * is capped at 4.5MB — so a 30MB email is only reachable as several small
 * requests with the message assembled at the send.
 *
 * The limits are checked here, at the upload route, and again at the send. This
 * copy is the one that exists so the operator finds out before spending a
 * minute uploading, not the one that is load bearing.
 */
export function AttachmentPicker({
  kind,
  owner,
  files,
  onChange,
  onNeedOwner,
  maxFileBytes,
  bodyBytes = 0,
  disabled = false,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const used = files.reduce((sum, file) => sum + file.byteSize, 0);
  const left = remainingBytes(used, bodyBytes);

  async function upload(chosen: File[]) {
    setError(null);

    // A broadcast has nowhere to put a file until it has been saved once. Doing
    // it here rather than refusing means "attach" works on the first click.
    let target = owner;
    if (!target && onNeedOwner) target = await onNeedOwner();
    if (!target) {
      setError("Give this message a subject first — the draft is what files attach to.");
      return;
    }

    // Sequential, not parallel: each request carries a whole file, and four at
    // once is four times the memory on a serverless instance for no gain on a
    // connection that is already saturated by the first.
    let attached = files;

    for (const file of chosen) {
      const verdict = checkAttachment(
        { filename: file.name, byteSize: file.size },
        attached,
        bodyBytes,
      );

      if (!verdict.ok) {
        setError(verdict.message);
        break;
      }

      setBusy(file.name);

      try {
        const body = new FormData();
        body.set("scope", kind);
        body.set("for", target);
        body.set("file", file);

        const response = await fetch("/api/attachments", { method: "POST", body });
        const result = (await response.json()) as
          | { ok: true; file: AttachedFile }
          | { ok: false; message: string };

        if (!result.ok) {
          setError(result.message);
          break;
        }

        attached = [...attached, result.file];
        onChange(attached);
      } catch {
        // A body over the platform's limit never reaches the route, so this is
        // where that failure surfaces — as a network error with no response.
        setError(`${file.name} could not be uploaded. It may be too large to send in one piece.`);
        break;
      } finally {
        setBusy(null);
      }
    }
  }

  async function remove(file: AttachedFile) {
    if (!owner) return;

    const next = files.filter((candidate) => candidate.id !== file.id);
    onChange(next);

    const result = await removeAttachment(kind, owner, file.id);
    if (!result.ok) setError(result.message);
  }

  return (
    <div className="attachments">
      <input
        ref={input}
        id={inputId}
        type="file"
        multiple
        className="sr-only"
        disabled={disabled || busy !== null}
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? []);
          // Cleared before the upload so choosing the same file twice in a row
          // still fires a change event.
          event.target.value = "";
          if (chosen.length > 0) void upload(chosen);
        }}
      />

      {files.length > 0 && (
        <ul className="attachment-list">
          {files.map((file) => (
            <li key={file.id} className="attachment">
              <Paperclip aria-hidden />
              <span className="attachment-name">{file.filename}</span>
              <span className="attachment-size">{formatBytes(file.byteSize)}</span>
              {!disabled && (
                <button
                  type="button"
                  className="tape-remove"
                  onClick={() => void remove(file)}
                  aria-label={`Remove ${file.filename}`}
                >
                  <X width={13} height={13} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="attachment-actions">
        <button
          type="button"
          className="abtn abtn-quiet abtn-sm"
          disabled={disabled || busy !== null}
          onClick={() => input.current?.click()}
        >
          <Paperclip aria-hidden />
          {busy ? `Uploading ${busy}…` : "Attach files"}
        </button>

        <span className="attachment-hint">
          {files.length > 0
            ? `${formatBytes(used)} attached · ${formatBytes(left)} left`
            : `Up to ${formatBytes(maxFileBytes)} a file, ${formatBytes(RESEND_MAX_EMAIL_BYTES)} an email once encoded`}
        </span>
      </div>

      {error && (
        <p className="note" data-tone="error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
