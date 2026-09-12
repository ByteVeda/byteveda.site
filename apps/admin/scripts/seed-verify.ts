/**
 * Seeds a throwaway database with the states the inbox has to handle.
 *
 * Not part of the app and not run by CI — this exists so the inbox can be opened
 * in a browser against a local Postgres, with every case on the page at once:
 * a conversation that was answered, one that is unread, one whose body only
 * ever arrived as HTML, one that was archived, and a reply that failed to send.
 *
 *   DATABASE_URL=… node --import tsx scripts/seed-verify.ts
 *
 * Prints the session token to put in the `bv_admin_session` cookie.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  adminUsers,
  closeDb,
  emailThreads,
  getDb,
  inboundMessages,
  outboundMessages,
  sessions,
} from "@byteveda/db";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const at = (ago: number) => new Date(Date.now() - ago);

async function main() {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");

  const [created] = await db
    .insert(adminUsers)
    .values({
      githubId: 67143288,
      login: "pratyush618",
      name: "Pratyush Sharma",
      avatarUrl: null,
    })
    .onConflictDoNothing({ target: adminUsers.githubId })
    .returning();

  const [existing] = await db.select().from(adminUsers).limit(1);
  const owner = created ?? existing;

  await db.insert(sessions).values({
    userId: owner.id,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 7 * DAY),
  });

  await db.insert(emailThreads).values([
    // The conversation from the screenshots: unread, and stored with no body at
    // all because the webhook believed `email.received` carried one.
    {
      threadKey: "pratyush.sharma@definable.ai::test mail",
      subject: "Test mail",
      correspondentEmail: "pratyush.sharma@definable.ai",
      correspondentName: "Pratyush Sharma",
      mailbox: "conduct@byteveda.org",
      preview: "",
      lastMessageAt: at(6 * MINUTE),
      lastInboundAt: at(6 * MINUTE),
    },
    // Answered, and the reply is the last thing in it. This is the one the bug
    // report was about: the conversation ended on their message.
    {
      threadKey: "ada@example.test::about the queue",
      subject: "About the queue",
      correspondentEmail: "ada@example.test",
      correspondentName: "Ada Lovelace",
      mailbox: "hello@byteveda.org",
      preview: "After. The jitter is applied to the capped delay, not the other way round.",
      lastMessageAt: at(2 * HOUR),
      lastInboundAt: at(3 * HOUR),
      lastOutboundAt: at(2 * HOUR),
      readAt: at(2 * HOUR),
    },
    // A reply that did not send, so the thread shows the attempt and its error
    // but is not marked answered.
    {
      threadKey: "grace@example.test::speaking at the meetup",
      subject: "Speaking at the meetup",
      correspondentEmail: "grace@example.test",
      correspondentName: "Grace Hopper",
      mailbox: "hello@byteveda.org",
      preview: "Would you be up for twenty minutes on the compiler work in March?",
      lastMessageAt: at(2 * DAY),
      lastInboundAt: at(2 * DAY),
      readAt: at(2 * DAY),
    },
    // Filed away. Only visible under the Archived filter.
    {
      threadKey: "jean@example.test::old thread",
      subject: "Old thread",
      correspondentEmail: "jean@example.test",
      correspondentName: null,
      mailbox: "conduct@byteveda.org",
      preview: "Settled this one months ago.",
      lastMessageAt: at(40 * DAY),
      lastInboundAt: at(40 * DAY),
      readAt: at(39 * DAY),
      archivedAt: at(39 * DAY),
    },
  ]);

  await db.insert(inboundMessages).values([
    {
      resendId: "verify-html-only",
      threadKey: "pratyush.sharma@definable.ai::test mail",
      fromEmail: "pratyush.sharma@definable.ai",
      fromName: "Pratyush Sharma",
      toEmail: "conduct@byteveda.org",
      subject: "Test mail",
      text: "",
      html: null,
      receivedAt: at(6 * MINUTE),
    },
    {
      resendId: "verify-both",
      threadKey: "ada@example.test::about the queue",
      fromEmail: "ada@example.test",
      fromName: "Ada Lovelace",
      toEmail: "hello@byteveda.org",
      subject: "About the queue",
      text: "Read your piece on backoff. Does the cap apply before or after the jitter?\n\nAda",
      html: "<p>Read your piece on backoff. Does the cap apply <b>before</b> or after the jitter?</p><p>Ada</p>",
      receivedAt: at(3 * HOUR),
    },
    {
      resendId: "verify-meetup",
      threadKey: "grace@example.test::speaking at the meetup",
      fromEmail: "grace@example.test",
      fromName: "Grace Hopper",
      toEmail: "hello@byteveda.org",
      subject: "Speaking at the meetup",
      text: "Would you be up for twenty minutes on the compiler work in March?",
      html: null,
      receivedAt: at(2 * DAY),
    },
    {
      resendId: "verify-archived",
      threadKey: "jean@example.test::old thread",
      fromEmail: "jean@example.test",
      fromName: null,
      toEmail: "conduct@byteveda.org",
      subject: "Old thread",
      text: "Settled this one months ago.",
      html: null,
      receivedAt: at(40 * DAY),
    },
  ]);

  await db.insert(outboundMessages).values([
    {
      resendId: "out-queue",
      threadKey: "ada@example.test::about the queue",
      toEmail: "ada@example.test",
      fromEmail: "hello@byteveda.org",
      subject: "Re: About the queue",
      kind: "reply",
      bodyText: "After. The jitter is applied to the capped delay, not the other way round.",
      sentAt: at(2 * HOUR),
    },
    {
      // Failed, so the thread shows it with its error and stays unanswered.
      resendId: null,
      threadKey: "grace@example.test::speaking at the meetup",
      toEmail: "grace@example.test",
      fromEmail: "hello@byteveda.org",
      subject: "Re: Speaking at the meetup",
      kind: "reply",
      bodyText: "March works. Send me the date and I will hold it.",
      error: "The sending domain is not verified.",
      sentAt: at(DAY),
    },
    {
      // A reply from before bodies were stored: linked, but with nothing to show.
      resendId: "out-legacy",
      threadKey: "jean@example.test::old thread",
      toEmail: "jean@example.test",
      fromEmail: "conduct@byteveda.org",
      subject: "Re: Old thread",
      kind: "reply",
      bodyText: "",
      sentAt: at(39 * DAY),
    },
  ]);

  console.log(token);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
