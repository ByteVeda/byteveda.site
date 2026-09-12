import { type NextRequest, NextResponse } from "next/server";
import { fetchInboundBody } from "@/lib/email/client";
import { type InboundEvent, inboundRow } from "@/lib/email/inbound";
import { verifySignature } from "@/lib/email/webhook";
import { recordInbound } from "@/lib/inbox/store";
import { inboxChanged } from "@/lib/realtime";

export const dynamic = "force-dynamic";

type InboundPayload = { type?: string; data?: Partial<InboundEvent> };

/**
 * Inbound mail from Resend.
 *
 * Sits outside the proxy's cookie gate because the caller is Resend, not a
 * browser — the signature is the authentication. The raw body is read as text
 * and verified before it is parsed: re-serialising the JSON would change the
 * bytes the signature covers.
 *
 * Two steps, not one. The webhook says a message arrived and names it; the
 * message itself is fetched. See `lib/email/inbound.ts` for why.
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

  const event = data as InboundEvent;
  const fetched = await fetchInboundBody(event.email_id);

  // Stores the message and moves its conversation. A webhook is delivered at
  // least once, and this reports false for the second delivery — see
  // `lib/inbox/store.ts` for why the thread has to be left alone too.
  const stored = await recordInbound(inboundRow(event, fetched.ok ? fetched.body : {}));

  // Only a message that is actually new should light up an open console; a
  // redelivery has nothing to announce.
  if (stored) inboxChanged.publish();

  return NextResponse.json({ received: event.email_id, stored });
}
