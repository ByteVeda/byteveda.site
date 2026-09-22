/**
 * Order mail.
 *
 * Plain template-literal strings with inline styles, the same approach the
 * admin console takes: two short messages do not earn a rendering dependency.
 * Every template ships a text part beside the HTML, and every interpolated
 * value goes through `escapeHtml` — chapter titles and subjects are typed by
 * whoever is ordering.
 *
 * Only one of the two carries prices. Buying is not open yet, so what the
 * visitor asked for is a free sample and their copy shows no money at all; the
 * team's copy keeps the figures, because the one reader who wants to know what
 * the shortlist is worth is the person filling it.
 */

import type { OrderLine } from "@/features/orders";
import { site, TURNAROUND } from "@/lib/site";

export type Email = { subject: string; html: string; text: string };

const ACCENT = "#1f9d54";
const INK = "#1b1a15";
const DIM = "#615d52";
const LINE = "#e6e1d6";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(body: string, footer: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(site.name)}</title></head>
<body style="margin:0;padding:0;background:#f6f4ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ee;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;">
<tr><td style="padding:28px 28px 8px;">
<div style="font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};letter-spacing:-0.01em;">
byteveda <span style="color:${DIM};">academy</span><span style="color:${ACCENT};">.</span></div>
</td></tr>
<tr><td style="padding:8px 28px 24px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};">
${body}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid ${LINE};font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${DIM};">
${footer}
</td></tr>
</table></td></tr></table></body></html>`;
}

/** `priced` prints what the full set would cost. Only the team's copy sets it. */
function lineTable(line: OrderLine, priced: boolean): string {
  const value = priced
    ? `
<tr>
<td style="padding:14px 0;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${DIM};">List value</td>
<td style="padding:14px 0;text-align:right;font-size:22px;font-weight:700;color:${ACCENT};">₹${line.price}</td>
</tr>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-top:2px solid ${LINE};">
<tr>
<td style="padding:10px 0;border-bottom:1px solid ${LINE};">
<div style="font-weight:600;">${escapeHtml(line.title)}</div>
<div style="font-size:13px;color:${DIM};">${escapeHtml(line.meta)}</div>
</td>
</tr>${value}
</table>`;
}

function lineText(line: OrderLine, priced: boolean): string[] {
  const rows = [`- ${line.title} (${line.meta})`];
  return priced ? [...rows, `List value: ₹${line.price}`] : rows;
}

/** Goes to whoever asked for the sheet. No price: the sample is free. */
export function orderReceivedEmail(input: { reference: string; line: OrderLine }): Email {
  const { reference, line } = input;

  return {
    subject: `Your sample — ${reference}`,
    html: layout(
      `<p style="margin:0 0 14px;">We have your request. Reference <strong>${escapeHtml(reference)}</strong>.</p>
${lineTable(line, false)}
<p style="margin:0 0 14px;">A print-ready sheet with its answer key goes out within ${TURNAROUND}. If it is not what you expected, reply to this email and tell us what to change.</p>
<p style="margin:0;color:${DIM};font-size:14px;">The sample is free and nothing has been charged. It is one per address, so this is yours. Buying full chapter packs is coming soon — we will email you when it opens.</p>`,
      `Sent by ${escapeHtml(site.name)} · ${escapeHtml(site.domain)}`,
    ),
    text: [
      `We have your request. Reference ${reference}.`,
      "",
      ...lineText(line, false),
      "",
      `A print-ready sheet with its answer key goes out within ${TURNAROUND}. Reply to this email if it is not what you expected.`,
      "",
      "The sample is free and nothing has been charged. It is one per address, so this is yours. Buying full chapter packs is coming soon — we will email you when it opens.",
      "",
      `${site.name} · ${site.domain}`,
    ].join("\n"),
  };
}

/** Goes to the team inbox — this is the work order, price and all. */
export function orderNotificationEmail(input: {
  reference: string;
  email: string;
  line: OrderLine;
}): Email {
  const { reference, email, line } = input;
  const setting = line.madeToOrder
    ? "Needs setting before it can go."
    : "On the shelf; send as it stands.";

  return {
    subject: `[${reference}] sample · ${line.title} · ${email}`,
    html: layout(
      `<p style="margin:0 0 14px;">Sample request from <strong>${escapeHtml(email)}</strong>. Send a sheet, not an invoice.</p>
${lineTable(line, true)}
<p style="margin:0;color:${DIM};font-size:14px;">${setting} Due within ${TURNAROUND}.</p>`,
      `Reference ${escapeHtml(reference)}`,
    ),
    text: [
      `Sample request from ${email}. Send a sheet, not an invoice.`,
      "",
      ...lineText(line, true),
      "",
      `${setting} Due within ${TURNAROUND}.`,
      `Reference ${reference}`,
    ].join("\n"),
  };
}
