"use server";

import { revalidatePath } from "next/cache";
import * as attachments from "@/features/attachments";
import {
  getSession,
  type Permission,
  readableWorkspaces,
  type SessionContext,
} from "@/features/auth";
import {
  bodyMissing,
  composedEmail,
  fetchInboundBody,
  normaliseEmail,
  reachThread,
  replyEmail,
  requires,
  sendEmail,
  threadKeyFor,
} from "@/features/mail";
import { emailConfigured } from "@/lib/email/client";
import { getConversation, listSendableAddresses } from "@/lib/inbox/queries";
import * as store from "@/lib/inbox/store";
import { inboxChanged } from "@/lib/realtime";

export type InboxResult = { ok: boolean; message: string };

/**
 * Every action here, before it does anything.
 *
 * Three questions in one call: is there a session, does the role carry the
 * permission, and is the conversation one this operator may see. The last is
 * the one that is easy to forget — a thread key is in the URL, and an operator
 * scoped to the academy's mail could otherwise archive a ByteVeda conversation
 * by pasting one into a fetch.
 */
async function permit(
  threadKey: string,
  permission: Permission,
): Promise<{ ok: true; session: SessionContext } | { ok: false; message: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Your session has expired. Sign in again." };

  const verdict = await reachThread(threadKey, session.access, permission);
  if (!verdict.ok) return { ok: false, message: verdict.message };

  return { ok: true, session };
}

/**
 * What opening a conversation did.
 *
 * `error` is set when a message in the thread has no body and Resend would not
 * hand one over. The browser is the only place that report is any use — the
 * operator is looking at the empty conversation it explains.
 */
export type ThreadOpened = { repaired: number; error: string | null };

/** Announces to every open console, and re-renders this one. */
function announce(): void {
  revalidatePath("/inbox");
  inboxChanged.publish();
}

/**
 * Everything opening a conversation implies: its messages are readable, and it
 * is no longer unread.
 *
 * Called from the browser rather than while rendering. Two reasons, both of
 * which were bugs: `revalidatePath` throws if it runs during a render, and a
 * `<Link>` prefetch renders the target page — so marking read server-side meant
 * hovering a thread in the list marked it read without anyone opening it.
 */
export async function openThread(threadKey: string): Promise<ThreadOpened> {
  const allowed = await permit(threadKey, "mail.read");
  // Nothing to report: the page that called this is already showing whatever
  // the refusal would say, and a notice about a conversation the operator
  // cannot see would be a notice about nothing.
  if (!allowed.ok) return { repaired: 0, error: null };

  const backfill = await backfillBodies(threadKey, allowed.session);
  const read = await store.markThreadRead(threadKey);

  // Nothing changed on a second visit to an already-read conversation.
  // Announcing anyway would refresh every open console for no reason, and
  // refresh this one into calling back here.
  if (read || backfill.repaired > 0) announce();

  return backfill;
}

/**
 * Fetches the bodies of any messages in a thread that were stored without one.
 *
 * Repairs the mail that arrived while the webhook believed the payload carried
 * the message. Nothing schedules this — a conversation is repaired when someone
 * opens it, which is the only time it matters.
 *
 * One reason is reported, not one per message: a thread whose bodies are
 * missing is missing them all for the same reason, and that reason is almost
 * always the API key.
 */
async function backfillBodies(threadKey: string, session: SessionContext): Promise<ThreadOpened> {
  if (!emailConfigured()) {
    return { repaired: 0, error: null };
  }

  const conversation = await getConversation(threadKey, {
    allowed: readableWorkspaces(session.access),
  });
  // Only what arrived. A sent message with no body is one from before replies
  // were kept, and Resend has nothing to return for it.
  const missing =
    conversation?.messages.filter(
      (message) => message.direction === "in" && message.resendId && bodyMissing(message),
    ) ?? [];

  if (missing.length === 0) return { repaired: 0, error: null };

  const fetched = await Promise.all(
    missing.map(async (message) => ({
      id: message.id,
      result: await fetchInboundBody(message.resendId as string),
    })),
  );

  let repaired = 0;
  let error: string | null = null;

  for (const { id, result } of fetched) {
    if (!result.ok) {
      error ??= result.reason;
      continue;
    }

    const { text, html, headers } = result.body;
    // Resend answered, and the message really is empty. Nothing to write, and
    // nothing to complain about either.
    if (!text?.trim() && !html?.trim()) continue;

    await store.repairBody(id, {
      text: text ?? null,
      html: html ?? null,
      headers: headers ?? null,
    });
    repaired += 1;
  }

  return { repaired, error };
}

/** Puts a conversation back to unread. */
export async function markThreadUnread(threadKey: string): Promise<InboxResult> {
  const allowed = await permit(threadKey, "mail.manage");
  if (!allowed.ok) return allowed;

  await store.markThreadUnread(threadKey);

  announce();
  return { ok: true, message: "Marked unread." };
}

/**
 * Files a conversation away, or brings it back.
 *
 * Archiving is what makes the inbox finishable. Deleting was the only way to
 * clear a thread before this, which meant the choice was between a list that
 * grew without limit and destroying the correspondence.
 */
export async function setThreadArchived(
  threadKey: string,
  archived: boolean,
): Promise<InboxResult> {
  const allowed = await permit(threadKey, "mail.manage");
  if (!allowed.ok) return allowed;

  await store.setThreadArchived(threadKey, archived);

  announce();
  return { ok: true, message: archived ? "Archived." : "Moved back to the inbox." };
}

/** Removes a conversation and everything received in it. */
export async function deleteThread(threadKey: string): Promise<InboxResult> {
  const allowed = await permit(threadKey, "mail.manage");
  if (!allowed.ok) return allowed;

  // Anything still waiting in the reply box goes with it. The foreign key only
  // covers files that were sent; a staged upload belongs to a composer, and
  // this is the composer being closed for good.
  await attachments.discardAll({ kind: "reply", id: threadKey });
  await store.deleteThread(threadKey);

  announce();
  return { ok: true, message: "Deleted." };
}

/**
 * Replies to a conversation.
 *
 * The reply is quoted the way a mail client would quote it, so the recipient
 * sees the conversation rather than a bare sentence with no context. What gets
 * stored against the thread is the text that was typed — see `sendEmail`.
 */
export async function replyToThread(threadKey: string, body: string): Promise<InboxResult> {
  const allowed = await permit(threadKey, "mail.send");
  if (!allowed.ok) return allowed;

  const scope = { kind: "reply", id: threadKey } as const;

  const text = body.trim();
  // A file with a sentence is a reply; a file on its own is one too. What is
  // refused is an empty message with nothing attached.
  const files = await attachments.loadForSend(scope);
  if (!text && files.length === 0) return { ok: false, message: "Write something first." };
  if (!emailConfigured()) {
    return { ok: false, message: "Set RESEND_API_KEY before sending." };
  }

  const conversation = await getConversation(threadKey, {
    allowed: readableWorkspaces(allowed.session.access),
  });
  if (!conversation) return { ok: false, message: "That conversation no longer exists." };

  const { thread, messages } = conversation;
  const quoted = [...messages].reverse().find((message) => message.direction === "in");

  // Answer from the address they wrote to. A reply to conduct@ that arrives
  // from hello@ reads as a different correspondent, breaks threading in the
  // recipient's client, and sends their next message to the wrong mailbox.
  const from = thread.mailbox || undefined;

  const result = await sendEmail({
    to: thread.correspondentEmail,
    email: replyEmail({ subject: thread.subject, body: text, quoted: quoted?.text ?? "" }),
    kind: "reply",
    from,
    replyTo: from,
    thread: { key: threadKey, body: text },
    attachments: files.map((file) => ({
      filename: file.filename,
      contentType: file.contentType,
      content: file.content,
    })),
  });

  // The attempt is in the conversation either way — `sendEmail` filed it under
  // the thread key. What a failure must not do is move the conversation on, or
  // the inbox would show it as answered.
  if (!result.ok) {
    announce();
    return { ok: false, message: result.error ?? "The reply did not send." };
  }

  // Only now do the files stop being drafts. A failed send leaves them staged,
  // which is what makes the retry the same button rather than four uploads.
  if (result.messageId) await attachments.claim(scope, result.messageId);

  await store.markThreadAnswered(threadKey, text || attached(files));

  announce();
  return { ok: true, message: `Replied to ${thread.correspondentEmail}.` };
}

/** What the inbox list shows as the last line when the reply was only files. */
function attached(files: { filename: string }[]): string {
  if (files.length === 1) return `Sent ${files[0].filename}`;
  return `Sent ${files.length} files`;
}

/** Deliberately stricter than the RFC, and the same shape the academy uses. */
const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export type ComposeDraft = {
  /** Which of our addresses it goes out as. Checked against the readable set. */
  from: string;
  to: string;
  subject: string;
  body: string;
  /** The attachment scope the files were staged under. */
  draftId: string;
};

/**
 * Writes to somebody who has not written in.
 *
 * The console could only ever answer mail, which is fine until the thing you
 * need to do is send a sheet — the work order names a customer who has never
 * emailed this inbox, and the only way to reach them was another mail client
 * and no record of it here.
 *
 * A composed message opens a conversation rather than standing alone, keyed
 * the way an inbound reply will be keyed, so the answer lands in it. What goes
 * out is therefore in the inbox next to everything else, which is the point:
 * the send log is for auditing, and the thread is for knowing where you are.
 *
 * The from-address is re-checked against `listSendableAddresses` rather than
 * trusted from the form. That list is already scoped to the workspaces this
 * operator may read, so the check is also what stops somebody with the
 * academy's mail sending as ByteVeda.
 */
export async function composeMessage(draft: ComposeDraft): Promise<InboxResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Your session has expired. Sign in again." };

  const verdict = requires(session.access, "mail.send");
  if (!verdict.ok) return { ok: false, message: verdict.message };

  const to = normaliseEmail(draft.to);
  if (!EMAIL_SHAPE.test(to)) return { ok: false, message: "That is not an email address." };

  const subject = draft.subject.trim();
  if (!subject) return { ok: false, message: "Give it a subject." };

  const scope = { kind: "compose", id: draft.draftId } as const;
  const body = draft.body.trim();
  const files = await attachments.loadForSend(scope);
  if (!body && files.length === 0) return { ok: false, message: "Write something first." };

  if (!emailConfigured()) {
    return { ok: false, message: "Set RESEND_API_KEY before sending." };
  }

  const from = normaliseEmail(draft.from);
  const sendable = await listSendableAddresses({
    allowed: readableWorkspaces(session.access),
  });
  const sender = sendable.find((address) => address.email === from);
  if (!sender) {
    return { ok: false, message: "You cannot send as that address." };
  }

  // Before the send: the outbound row points at this key by foreign key, and
  // a failed attempt still belongs in a conversation somebody can open.
  const threadKey = threadKeyFor(to, subject);
  await store.openOutboundThread({
    threadKey,
    subject,
    to,
    from: sender.email,
    workspace: sender.workspace,
    body: body || attached(files),
  });

  const result = await sendEmail({
    to,
    email: composedEmail({ subject, body }),
    kind: "transactional",
    from: sender.email,
    replyTo: sender.email,
    thread: { key: threadKey, body },
    attachments: files.map((file) => ({
      filename: file.filename,
      contentType: file.contentType,
      content: file.content,
    })),
  });

  if (!result.ok) {
    announce();
    return { ok: false, message: result.error ?? "The message did not send." };
  }

  // Only now do the files stop being drafts, so a failed send is retried with
  // the same button rather than four uploads.
  if (result.messageId) await attachments.claim(scope, result.messageId);

  await store.markThreadAnswered(threadKey, body || attached(files));

  announce();
  return { ok: true, message: `Sent to ${to}.` };
}
