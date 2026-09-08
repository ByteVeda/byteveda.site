import { getDb, inboundMessages } from "@byteveda/db";
import { type NextRequest, NextResponse } from "next/server";
import { displayName, normaliseEmail, threadKeyFor } from "@/lib/email/thread";
import { verifySignature } from "@/lib/email/webhook";

export const dynamic = "force-dynamic";

type InboundPayload = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
  };
};

function firstRecipient(to: string | string[] | undefined): string {
  if (Array.isArray(to)) return to[0] ?? "";
  return to ?? "";
}

/**
 * Inbound mail from Resend.
 *
 * Sits outside the proxy's cookie gate because the caller is Resend, not a
 * browser — the signature is the authentication. The raw body is read as text
 * and verified before it is parsed: re-serialising the JSON would change the
 * bytes the signature covers.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  const verified = verifySignature({
    secret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    body,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  });

  if (!verified.ok) {
    console.warn(`[webhook] rejected an inbound message: ${verified.reason}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: InboundPayload;
  try {
    payload = JSON.parse(body) as InboundPayload;
  } catch {
    return NextResponse.json({ error: "expected a json body" }, { status: 400 });
  }

  // Resend sends delivery and bounce events down the same webhook. Anything
  // that is not an arriving message is acknowledged and ignored.
  if (payload.type !== "email.received" && payload.type !== "inbound.email.received") {
    return NextResponse.json({ ignored: payload.type ?? "unknown" });
  }

  const data = payload.data ?? {};
  if (!data.email_id || !data.from) {
    return NextResponse.json({ error: "missing email_id or from" }, { status: 400 });
  }

  const subject = data.subject ?? "";

  await getDb()
    .insert(inboundMessages)
    .values({
      resendId: data.email_id,
      threadKey: threadKeyFor(data.from, subject),
      fromEmail: normaliseEmail(data.from),
      fromName: displayName(data.from),
      toEmail: normaliseEmail(firstRecipient(data.to)),
      subject,
      text: data.text ?? "",
      html: data.html ?? null,
      headers: data.headers ?? null,
    })
    // A webhook is delivered at least once. The unique id makes a redelivery a
    // no-op instead of a duplicate in the inbox.
    .onConflictDoNothing({ target: inboundMessages.resendId });

  return NextResponse.json({ received: data.email_id });
}
