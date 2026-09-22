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
