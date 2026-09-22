/**
 * What mail is, with no imports that reach the database.
 *
 * One Resend account serves two businesses, four kinds of outbound message and
 * an inbound webhook, and every one of those needs the same handful of rules:
 * which workspace an address belongs to, whether an operator may touch a
 * conversation, how a subject groups into a thread, what a message looks like.
 * They are gathered here so that a page, a server action and a route handler
 * are answering from one copy rather than three.
 *
 * Client-safe on purpose — `@byteveda/db` drags `pg` into any bundle that
 * touches it, so only the constants module and `import type`, which is erased,
 * appear above. Anything that reads or writes lives in `queries.ts`,
 * `store.ts` and `service.ts`.
 */

import type { InboundMessage } from "@byteveda/db";
import { MAIL_WORKSPACE_LABELS, MAIL_WORKSPACES, type MailWorkspace } from "@byteveda/db/constants";
import { type AccessSnapshot, can, type Permission } from "@/features/auth/model";

export type { MailWorkspace };
export { MAIL_WORKSPACE_LABELS, MAIL_WORKSPACES };

/**
 * Which business a piece of mail belongs to.
 *
 * One Resend account, one inbound webhook, two businesses. A reader asking
 * about FlexiQ and a parent asking about a worksheet arrive through the same
 * hole in the wall, and the only thing that separates them is the address they
 * wrote to — so that address is where the answer comes from.
 *
 * The classification lives here and nowhere else. The column on
 * `email_threads` is written from this function, the migration that backfilled
 * it says so in a comment, and every query filters on the column rather than
 * re-deciding. Two copies of a rule like this drift, and the drift shows up as
 * mail that is invisible to the person who is supposed to answer it.
 */

/**
 * Local parts that belong to the academy, whatever domain they are on.
 *
 * `academy@` is the sender on order mail (see `apps/academy/src/lib/env.ts`),
 * and `orders@` is where the work orders land. The other two are named now so
 * that turning them on at Resend is a DNS change rather than a deploy.
 */
const ACADEMY_MAILBOXES = new Set(["academy", "orders", "samples", "admissions"]);

/** Any subdomain of the academy's own domain, e.g. `hello@academy.byteveda.org`. */
const ACADEMY_DOMAIN_PREFIX = "academy.";

export function isMailWorkspace(value: string | undefined | null): value is MailWorkspace {
  return MAIL_WORKSPACES.includes(value as MailWorkspace);
}

/** Whether one address belongs to the academy. */
function academyAddress(value: string): boolean {
  const address = value.trim().toLowerCase();
  const at = address.lastIndexOf("@");

  const local = at === -1 ? address : address.slice(0, at);
  const domain = at === -1 ? "" : address.slice(at + 1);

  // A `+tag` suffix is the sender's, not ours: `orders+urgent@` is still orders.
  const base = local.split("+")[0];

  return ACADEMY_MAILBOXES.has(base) || domain.startsWith(ACADEMY_DOMAIN_PREFIX);
}

/**
 * Which business a message belongs to.
 *
 * The address it arrived at is the main signal, and `sender` is the second one
 * — because a good deal of the academy's mail arrives from itself. Every sample
 * request sends a work order *from* `academy@byteveda.org` to whatever
 * `ACADEMY_ORDER_INBOX` names, and that defaults to `support@byteveda.org`. On
 * the to-address alone, every order in the order book would file under
 * ByteVeda, which is exactly the pile this feature exists to split.
 *
 * Fixing it at the routing end — pointing the academy at `orders@` — is the
 * tidier answer and is still worth doing. This makes the console right about
 * the mail it already has either way.
 */
export function workspaceOf(mailbox: string, sender = ""): MailWorkspace {
  if (academyAddress(mailbox)) return "academy";
  if (sender && academyAddress(sender)) return "academy";
  return "byteveda";
}

export function workspaceLabel(workspace: MailWorkspace): string {
  return MAIL_WORKSPACE_LABELS[workspace];
}

/**
 * Whether an operator may touch a particular conversation.
 *
 * Mail is the one part of the console where the permission is not the whole
 * answer: `mail.send` says somebody answers mail, and their workspaces say
 * whose. Both have to hold, and they have to hold in every path that reaches a
 * conversation — the page, the four thread actions, the reply, the attachment
 * upload and the attachment download. This is that check, once.
 *
 * A conversation in a workspace this operator cannot read answers exactly like
 * one that does not exist. The alternative confirms, to somebody trying thread
 * keys, that there is something there.
 */

export type Denial = { ok: false; status: number; message: string };
export type Allowed = { ok: true };
export type Verdict = Allowed | Denial;

export const ALLOWED: Allowed = { ok: true };

export const forbidden = (message: string): Denial => ({ ok: false, status: 403, message });
export const missing = (message: string): Denial => ({ ok: false, status: 404, message });

const REFUSALS: Record<string, string> = {
  "mail.read": "Your role does not allow reading mail.",
  "mail.send": "Your role does not allow replying to mail.",
  "mail.manage": "Your role does not allow filing or deleting mail.",
  "broadcasts.send": "Your role does not allow sending broadcasts.",
  "subscribers.read": "Your role does not allow reading the mailing list.",
};

export function requires(access: AccessSnapshot, permission: Permission): Verdict {
  if (can(access, permission)) return ALLOWED;
  return forbidden(REFUSALS[permission] ?? "Your role does not allow that.");
}

/**
 * Grouping inbound mail into conversations.
 *
 * Proper threading would follow `References` and `In-Reply-To`, but those are
 * absent often enough — a correspondent writing from a webmail client that
 * starts a fresh message — that the pragmatic key is the correspondent plus
 * the subject with its reply prefixes stripped.
 *
 * Everything here runs on strings an unauthenticated sender chose: anyone can
 * email the inbound address. That rules out patterns whose cost grows faster
 * than the input — a nested quantifier over optional whitespace is exactly the
 * shape that lets a crafted subject pin the webhook handler. The prefixes are
 * stripped one at a time with a bounded pattern, and the address is split with
 * plain string operations.
 */

/** Longer than any real subject; a header is capped at 998 octets by RFC 5322. */
const MAX_SUBJECT = 512;

/**
 * One reply prefix: `Re:`, `RE :`, `Fwd:`, `AW:`, `Re[2]:`.
 *
 * Anchored, and every repetition is bounded. Applied repeatedly by the caller
 * rather than wrapped in `(...)+`, which is what made the original quadratic.
 */
const REPLY_PREFIX = /^(re|fw|fwd|aw|sv|vs|antw)[ \t]{0,4}(\[\d{1,3}\])?[ \t]{0,4}:[ \t]{0,4}/i;

export function normaliseSubject(subject: string): string {
  let text = subject.slice(0, MAX_SUBJECT).trim();

  // Each pass removes exactly one prefix, so the work is linear in the number
  // of prefixes rather than exponential in the whitespace between them.
  for (;;) {
    const stripped = text.replace(REPLY_PREFIX, "");
    if (stripped === text) break;
    text = stripped.trimStart();
  }

  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * `Name <a@b.test>` and a bare address both reduce to the address.
 *
 * Deliberately not a regex: scanning for the last `<` is linear whatever the
 * input, where an unanchored `<([^>]+)>` retries from every position.
 */
export function normaliseEmail(address: string): string {
  const open = address.lastIndexOf("<");
  if (open !== -1) {
    const close = address.indexOf(">", open + 1);
    if (close !== -1)
      return address
        .slice(open + 1, close)
        .trim()
        .toLowerCase();
  }
  return address.trim().toLowerCase();
}

/** The display part of `"Ada Lovelace" <ada@example.test>`, or null. */
export function displayName(address: string): string | null {
  const open = address.lastIndexOf("<");
  if (open <= 0) return null;

  const name = address.slice(0, open).trim();
  // Strip one layer of surrounding quotes, which is all a display name carries.
  const unquoted =
    name.length > 1 && name.startsWith('"') && name.endsWith('"') ? name.slice(1, -1).trim() : name;

  return unquoted || null;
}

/**
 * Who a reply to this message should actually go to.
 *
 * `Reply-To` exists to say "answer somewhere other than where this came from",
 * and reading it is ordinary mail behaviour rather than a special case — every
 * client does it. The console did not, which is how the academy's work orders
 * ended up unanswerable: the academy sends them from its own sending alias
 * with the customer in `Reply-To`, so the conversation offered to reply to
 * ByteVeda, from ByteVeda, about a sheet a student was waiting for.
 *
 * Header names are matched case-insensitively — a header map is whatever the
 * sending server felt like capitalising — and a `Reply-To` that parses to
 * nothing, or back to the sender, is ignored so the fallback stays the `From`.
 */
export function replyTargetOf(
  fromAddress: string,
  headers: Record<string, string> | null | undefined,
): { email: string; name: string | null } {
  const from = { email: normaliseEmail(fromAddress), name: displayName(fromAddress) };
  if (!headers) return from;

  const raw = Object.entries(headers).find(
    ([name]) => name.trim().toLowerCase() === "reply-to",
  )?.[1];
  if (!raw) return from;

  // Only the first address. A `Reply-To` may list several, and a reply box
  // that silently fanned out to all of them would be a surprise.
  const first = raw.split(",")[0] ?? "";
  const email = normaliseEmail(first);

  // `@` alone is the cheap test that this is an address at all, and it is the
  // right one here: anything stranger is refused by the send, not by us.
  if (!email.includes("@") || email === from.email) return from;

  return { email, name: displayName(first) };
}

export function threadKeyFor(fromAddress: string, subject: string): string {
  const normalised = normaliseSubject(subject);
  // A subject that is only "Re:" leaves nothing; fall back so the whole
  // correspondence groups together rather than each message standing alone.
  return `${normaliseEmail(fromAddress)}::${normalised || "(no subject)"}`;
}

/**
 * Turning a Resend inbound notification into a row.
 *
 * The shape that matters: `email.received` is a *notification*, not the message.
 * Its payload carries the envelope — who wrote, to which address, about what —
 * and nothing else. The body lives behind `GET /emails/receiving/{id}` and has
 * to be fetched separately, which is why this takes two arguments.
 *
 * Getting that wrong is invisible: every field the webhook does send is present
 * and correct, the row inserts cleanly, and the conversation simply has no text
 * in it. Which is exactly how it shipped.
 */

/** The envelope, as the webhook sends it. */
export type InboundEvent = {
  email_id: string;
  from: string;
  to?: string | string[];
  subject?: string;
  /**
   * Resend does not send these on the webhook. They are accepted anyway so a
   * replayed fixture, or a future payload that inlines a short message, is used
   * rather than ignored in favour of a second API call.
   */
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string> | null;
};

/** The message, as `emails.receiving.get` returns it. */
export type InboundBody = {
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string> | null;
};

/**
 * The result of going to fetch one.
 *
 * A failure carries a sentence rather than a boolean because the console is
 * where it has to be read. The first version of this returned `null`, which
 * rendered a permission error and a genuinely empty message as the same blank
 * conversation — and the one thing anybody needed to know was the difference.
 */
export type InboundFetch = { ok: true; body: InboundBody } | { ok: false; reason: string };

/**
 * Resend's error codes, in words, with the fix rather than the diagnosis.
 *
 * `restricted_api_key` is the one that matters. Resend has exactly two
 * permission levels, sending access and full access, and *every* read is behind
 * the second — so an inbound mailbox wired up with the key that sends the
 * newsletter stores every message with an empty body and no explanation.
 */
const REASONS: Record<string, string> = {
  restricted_api_key:
    "RESEND_API_KEY may only send mail. Reading an inbound message needs a full-access key.",
  invalid_api_key: "Resend rejected RESEND_API_KEY.",
  missing_api_key: "RESEND_API_KEY is not set.",
  not_found: "Resend no longer has this message.",
  rate_limit_exceeded: "Resend is rate limiting the console. Opening this again will retry.",
};

/** What to tell the operator when Resend refuses to hand over a body. */
export function fetchFailureReason(error: { name?: string; message?: string }): string {
  const known = error.name ? REASONS[error.name] : undefined;
  if (known) return known;

  const detail = error.message?.trim();
  return detail ? `Resend could not return the message: ${detail}` : "Resend could not return it.";
}

export type InboundRow = Pick<
  InboundMessage,
  | "resendId"
  | "threadKey"
  | "fromEmail"
  | "fromName"
  | "toEmail"
  | "subject"
  | "text"
  | "html"
  | "headers"
>;

function firstRecipient(to: string | string[] | undefined): string {
  if (Array.isArray(to)) return to[0] ?? "";
  return to ?? "";
}

/**
 * Whether a row still needs its body fetched.
 *
 * Every message stored before the body fetch existed looks like this, so the
 * console can repair them on the way past rather than leaving a permanently
 * blank conversation behind.
 */
export function bodyMissing(message: Pick<InboundMessage, "text" | "html">): boolean {
  return !message.text.trim() && !message.html?.trim();
}

export function inboundRow(event: InboundEvent, body: InboundBody = {}): InboundRow {
  const subject = event.subject ?? "";

  // The fetched body wins: the webhook only ever carries these by accident, and
  // an empty string from it must not mask the real message.
  const text = body.text?.trim() ? body.text : (event.text ?? "");
  const html = body.html?.trim() ? body.html : (event.html ?? null);

  return {
    resendId: event.email_id,
    threadKey: threadKeyFor(event.from, subject),
    fromEmail: normaliseEmail(event.from),
    fromName: displayName(event.from),
    toEmail: normaliseEmail(firstRecipient(event.to)),
    subject,
    text,
    html,
    headers: body.headers ?? event.headers ?? null,
  };
}

/**
 * Email templates.
 *
 * Plain strings, no React renderer: these are four short messages, and a
 * rendering dependency would be more machinery than the thing it renders.
 * Every one ships a text part as well as HTML, because a mail client that
 * cannot show one has to show the other.
 *
 * Styling is inline and conservative — dark-mode-safe neutrals, one accent, a
 * single column under 600px. Mail clients support little more than that.
 */

export type Email = { subject: string; html: string; text: string };

const ACCENT = "#1f9d54";
const INK = "#1b1a15";
const DIM = "#615d52";
const LINE = "#e6e1d6";

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

/** The card every message sits in. `rows` are the `<tr>`s that go inside it. */
function shell(rows: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>ByteVeda</title></head>
<body style="margin:0;padding:0;background:#f6f4ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ee;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;">
${rows}
</table></td></tr></table></body></html>`;
}

function bodyRow(body: string, padding: string): string {
  return `<tr><td style="padding:${padding};font:400 15px/1.6 ${SANS};color:${INK};">
${body}
</td></tr>`;
}

/**
 * A message the console sends on its own account.
 *
 * Signup confirmations, announcements, broadcasts: nobody signs these, so the
 * wordmark at the top is the only thing saying who is writing, and the footer
 * is the only place the sender is named at all.
 */
function layout(body: string, footer: string): string {
  return shell(
    `<tr><td style="padding:28px 28px 8px;">
<div style="font:600 15px/1 ${SANS};color:${INK};letter-spacing:-0.01em;">
byteveda<span style="color:${ACCENT};">.</span></div>
</td></tr>
${bodyRow(body, "8px 28px 24px")}
<tr><td style="padding:16px 28px 24px;border-top:1px solid ${LINE};font:400 12px/1.5 ${SANS};color:${DIM};">
${footer}
</td></tr>`,
  );
}

/**
 * A message a person wrote, to a person.
 *
 * No wordmark and no footer, because both were saying the wrong thing. An
 * operator answering an academy customer signs off "ByteVeda Academy" — and a
 * `byteveda.` mark stamped above it contradicted the signature two lines
 * below. The footer was worse: "Sent from the ByteVeda console" told a parent
 * waiting on a worksheet the name of our internal tooling.
 *
 * What is left is the card and the words that were typed into it, which is
 * what a reply from a person is supposed to look like.
 */
function plainLayout(body: string): string {
  return shell(bodyRow(body, "28px"));
}

function button(href: string, label: string): string {
  return `<p style="margin:22px 0;"><a href="${href}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:${ACCENT};color:#ffffff;font:500 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-decoration:none;">${label}</a></p>`;
}

/**
 * Typed text as HTML paragraphs.
 *
 * A blank line is a paragraph break and a single newline is not, which is how
 * everybody writes in a textarea. Escaped on the way through: an operator can
 * paste anything in here, and it is going into a mail client that will render
 * it.
 */
function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px;">${escapeHtml(paragraph)}</p>`)
    .join("");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Asks a new signup to prove the address is theirs. */
export function confirmationEmail(confirmUrl: string): Email {
  return {
    subject: "Confirm your ByteVeda subscription",
    html: layout(
      `<p style="margin:0 0 8px;">Someone — hopefully you — signed this address up for occasional
       writing from ByteVeda about the tools we build.</p>
       <p style="margin:0;">Confirm to start receiving it.</p>
       ${button(confirmUrl, "Confirm subscription")}
       <p style="margin:0;color:${DIM};font-size:13px;">If it was not you, ignore this. Nothing is sent
       until the link above is followed.</p>`,
      "You are receiving this because someone entered this address on byteveda.org.",
    ),
    text: [
      "Someone - hopefully you - signed this address up for occasional writing",
      "from ByteVeda about the tools we build.",
      "",
      "Confirm to start receiving it:",
      confirmUrl,
      "",
      "If it was not you, ignore this. Nothing is sent until that link is followed.",
    ].join("\n"),
  };
}

/** Tells the list a post is up. */
export function announcementEmail(input: {
  title: string;
  description: string;
  url: string;
  unsubscribeUrl: string;
}): Email {
  return {
    subject: input.title,
    html: layout(
      `<h1 style="margin:0 0 10px;font:600 20px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:-0.02em;color:${INK};">${escapeHtml(input.title)}</h1>
       <p style="margin:0;color:${DIM};">${escapeHtml(input.description)}</p>
       ${button(input.url, "Read it")}`,
      `You are subscribed to ByteVeda. <a href="${input.unsubscribeUrl}" style="color:${DIM};">Unsubscribe</a>.`,
    ),
    text: [
      input.title,
      "",
      input.description,
      "",
      input.url,
      "",
      `Unsubscribe: ${input.unsubscribeUrl}`,
    ].join("\n"),
  };
}

/** A broadcast written in the console. `bodyHtml` is already-rendered Markdown. */
export function broadcastEmail(input: {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  unsubscribeUrl: string;
}): Email {
  return {
    subject: input.subject,
    html: layout(
      input.bodyHtml,
      `You are subscribed to ByteVeda. <a href="${input.unsubscribeUrl}" style="color:${DIM};">Unsubscribe</a>.`,
    ),
    text: `${input.bodyText}\n\nUnsubscribe: ${input.unsubscribeUrl}`,
  };
}

/** A reply sent from the inbox. Quoted original included, as a mail client would. */
/**
 * A message the console started, rather than one it is answering.
 *
 * `replyEmail` with nothing to quote would nearly do, except for the subject:
 * that one prefixes "Re:", and a sheet going out to somebody who never wrote
 * in should not arrive claiming to be a reply to a message they never sent.
 */
export function composedEmail(input: { subject: string; body: string }): Email {
  return {
    subject: input.subject,
    html: plainLayout(paragraphs(input.body)),
    text: input.body,
  };
}

export function replyEmail(input: { subject: string; body: string; quoted: string }): Email {
  const quoted = input.quoted.trim();

  return {
    subject: input.subject.toLowerCase().startsWith("re:") ? input.subject : `Re: ${input.subject}`,
    html: plainLayout(
      `${paragraphs(input.body)}${
        quoted
          ? `<blockquote style="margin:20px 0 0;padding:0 0 0 12px;border-left:2px solid ${LINE};color:${DIM};font-size:13px;white-space:pre-wrap;">${escapeHtml(quoted)}</blockquote>`
          : ""
      }`,
    ),
    text: quoted
      ? `${input.body}\n\n${quoted
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")}`
      : input.body,
  };
}

export type SendResult = {
  ok: boolean;
  /** Resend's id for the message, when it accepted one. */
  id?: string;
  /** The row this console wrote, whether the send worked or not. */
  messageId?: string;
  error?: string;
};
