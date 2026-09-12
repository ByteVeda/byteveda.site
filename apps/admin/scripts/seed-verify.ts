/**
 * Seeds a throwaway database with the exact state that broke the console.
 *
 * Not part of the app and not run by CI — this exists so the inbox can be opened
 * in a browser against a local Postgres, with an unread conversation whose body
 * only ever arrived as HTML. Both of those are what the production bugs needed:
 * `/inbox` 500ed on the unread flag, and the message rendered blank because the
 * webhook never fetched a body.
 *
 *   DATABASE_URL=… node --import tsx scripts/seed-verify.ts
 *
 * Prints the session token to put in the `bv_admin_session` cookie.
 */
import { createHash, randomBytes } from "node:crypto";
import { adminUsers, closeDb, getDb, inboundMessages, sessions } from "@byteveda/db";

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
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await db.insert(inboundMessages).values([
    // The conversation from the screenshots: unread, and stored with no body at
    // all because the webhook believed `email.received` carried one.
    {
      resendId: "verify-html-only",
      threadKey: "pratyush.sharma@definable.ai::test mail",
      fromEmail: "pratyush.sharma@definable.ai",
      fromName: "Pratyush Sharma",
      toEmail: "conduct@byteveda.org",
      subject: "Test mail",
      text: "",
      html: null,
      receivedAt: new Date(Date.now() - 6 * 60_000),
    },
    // One that arrived with both forms, to exercise the plain/HTML switch.
    {
      resendId: "verify-both",
      threadKey: "ada@example.test::about the queue",
      fromEmail: "ada@example.test",
      fromName: "Ada Lovelace",
      toEmail: "hello@byteveda.org",
      subject: "About the queue",
      text: "Read your piece on backoff. Does the cap apply before or after the jitter?\n\nAda",
      html: "<p>Read your piece on backoff. Does the cap apply <b>before</b> or after the jitter?</p><p>Ada</p>",
      readAt: new Date(),
      receivedAt: new Date(Date.now() - 3 * 60 * 60_000),
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
