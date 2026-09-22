import { getDb, type OutboundKind, outboundMessages } from "@byteveda/db";
import type { SendResult } from "./model";

/** The envelope of a send, as the row records it. */
export type OutboundRecord = {
  toEmail: string;
  fromEmail: string;
  subject: string;
  kind: OutboundKind;
  threadKey: string | null;
  bodyText: string;
  broadcastId: string | null;
};

/**
 * Files a send, whether it worked or not.
 *
 * The row in `outbound_messages` is written either way, so "did that go out?"
 * is answerable from the console rather than from Resend's dashboard —
 * including for the sends that failed, which are the ones worth asking about.
 *
 * The row id goes back to the caller so that whatever was attached can be
 * filed against the message that carried it.
 */
export async function recordOutbound(
  message: OutboundRecord,
  result: SendResult,
): Promise<SendResult> {
  const [row] = await getDb()
    .insert(outboundMessages)
    .values({
      resendId: result.id ?? null,
      toEmail: message.toEmail,
      fromEmail: message.fromEmail,
      subject: message.subject,
      kind: message.kind,
      threadKey: message.threadKey,
      bodyText: message.bodyText,
      broadcastId: message.broadcastId,
      error: result.error ?? null,
    })
    .returning({ id: outboundMessages.id });

  return { ...result, messageId: row?.id };
}
