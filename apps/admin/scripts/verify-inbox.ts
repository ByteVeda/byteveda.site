/**
 * Exercises the inbox against a real Postgres.
 *
 * Not part of CI — it needs a database, which is exactly what the unit tests
 * cannot have, and the things worth checking here are all statements the
 * database decides: what "unread" means once `read_at` and `last_inbound_at`
 * are both timestamps, whether a redelivered webhook moves a conversation, and
 * whether a search reaches into message bodies rather than only the preview.
 *
 * Destructive. Point it at a throwaway:
 *
 *   docker run -d --name bv -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=app \
 *     -p 55434:5432 postgres:16-alpine
 *   for f in packages/db/migrations/0*.sql; do psql … -f "$f"; done
 *   DATABASE_URL=postgresql://postgres:pw@localhost:55434/app DATABASE_SSL=disable \
 *     node --import tsx scripts/verify-inbox.ts
 */
import { closeDb, emailThreads, getDb, outboundMessages } from "@byteveda/db";
import { MAIL_WORKSPACES } from "@byteveda/db/constants";
import type { InboundRow } from "../src/lib/email/inbound";
import { countThreads, countUnread, getConversation, listThreads } from "../src/lib/inbox/queries";
import {
  markThreadAnswered,
  markThreadRead,
  markThreadUnread,
  recordInbound,
  setThreadArchived,
} from "../src/lib/inbox/store";

let failures = 0;

function check(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "pass" : "FAIL"}  ${what}${ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`,
  );
}

const KEY = "ada@example.test::about the queue";
const OTHER = "grace@example.test::the meetup";
const ACADEMY = "parent@example.test::the worksheet";

/** A super admin's view: every mailbox. What most of these checks run under. */
const ALL = { allowed: MAIL_WORKSPACES };
/** Somebody scoped to one business, which is what the workspaces exist for. */
const ONLY_BYTEVEDA = { allowed: ["byteveda"] as const };

function message(overrides: Partial<InboundRow> & { resendId: string }): InboundRow {
  return {
    threadKey: KEY,
    fromEmail: "ada@example.test",
    fromName: "Ada Lovelace",
    toEmail: "hello@byteveda.org",
    subject: "About the queue",
    text: "Does the cap apply before or after the jitter?",
    html: null,
    headers: null,
    ...overrides,
  };
}

async function main() {
  const db = getDb();
  await db.delete(outboundMessages);
  await db.delete(emailThreads);

  // ---- an arriving message opens a conversation ----

  const first = new Date("2026-09-01T10:00:00Z");
  check("a new message is stored", await recordInbound(message({ resendId: "m1" }), first), true);

  const [opened] = await listThreads(ALL);
  check("the conversation is unread", opened?.unread, true);
  check("nothing has been sent in it", opened?.answered, false);
  check(
    "its preview is the message",
    opened?.preview,
    "Does the cap apply before or after the jitter?",
  );
  check("the badge counts it", await countUnread(ALL), 1);

  // ---- a redelivery is a no-op ----

  check(
    "the same message again is refused",
    await recordInbound(message({ resendId: "m1", text: "changed" }), new Date()),
    false,
  );
  const [unchanged] = await listThreads(ALL);
  check(
    "and the conversation did not move",
    unchanged?.lastMessageAt.toISOString(),
    first.toISOString(),
  );
  check("nor was its preview rewritten", unchanged?.preview, opened?.preview);

  // ---- reading, and unreading ----

  // Every timestamp is explicit. "Unread" is a comparison between when their
  // last message arrived and when the conversation was last opened, so a test
  // that reads at the real `now` and then posts mail dated last week is
  // asserting the opposite of what it looks like.
  const readFirst = new Date("2026-09-01T12:00:00Z");
  check("opening it marks it read", await markThreadRead(KEY, readFirst), true);
  check("opening it again changes nothing", await markThreadRead(KEY, readFirst), false);
  check("the badge clears", await countUnread(ALL), 0);

  await markThreadUnread(KEY);
  check("marking unread puts it back", await countUnread(ALL), 1);
  await markThreadRead(KEY, readFirst);

  // ---- a second message makes it unread again ----

  const second = new Date("2026-09-02T10:00:00Z");
  await recordInbound(message({ resendId: "m2", text: "Following up on this." }), second);
  const [bumped] = await listThreads(ALL);
  check("new mail in a read conversation is unread again", bumped?.unread, true);
  check("and moves it to the top", bumped?.lastMessageAt.toISOString(), second.toISOString());

  // ---- answering it ----

  const replied = new Date("2026-09-03T10:00:00Z");
  await db.insert(outboundMessages).values({
    threadKey: KEY,
    toEmail: "ada@example.test",
    fromEmail: "hello@byteveda.org",
    subject: "Re: About the queue",
    kind: "reply",
    bodyText: "After the cap, not before.",
    sentAt: replied,
  });
  await markThreadAnswered(KEY, "After the cap, not before.", replied);

  const [answered] = await listThreads(ALL);
  check("answering marks it read", answered?.unread, false);
  check("and answered", answered?.answered, true);
  check("and says the last word was ours", answered?.weSpokeLast, true);
  check("and the preview is what we wrote", answered?.preview, "After the cap, not before.");

  const conversation = await getConversation(KEY, ALL);
  check(
    "the conversation has both directions, in order",
    conversation?.messages.map((one) => one.direction),
    ["in", "in", "out"],
  );
  check("the reply is in it", conversation?.messages.at(-1)?.text, "After the cap, not before.");

  // ---- archiving ----

  await setThreadArchived(KEY, true);
  check("archiving takes it out of the inbox", (await listThreads(ALL)).length, 0);
  check(
    "and puts it under archived",
    (await listThreads({ ...ALL, filter: "archived" })).length,
    1,
  );
  check("the counts agree", await countThreads(ALL), { inbox: 0, unread: 0, archived: 1 });

  // ---- new mail un-archives ----

  await recordInbound(
    message({ resendId: "m3", text: "One more thing." }),
    new Date("2026-09-04T10:00:00Z"),
  );
  check("mail arriving brings it back", (await listThreads(ALL)).length, 1);

  // ---- search ----

  await recordInbound(
    message({
      resendId: "g1",
      threadKey: OTHER,
      fromEmail: "grace@example.test",
      fromName: "Grace Hopper",
      subject: "The meetup",
      text: "Twenty minutes on compilers?",
    }),
    new Date("2026-09-05T10:00:00Z"),
  );

  check("search finds a subject", (await listThreads({ ...ALL, query: "meetup" })).length, 1);
  check("search finds a correspondent", (await listThreads({ ...ALL, query: "grace@" })).length, 1);
  check(
    "search reaches into a message body the preview does not show",
    (await listThreads({ ...ALL, query: "jitter" })).map((one) => one.threadKey),
    [KEY],
  );
  check(
    "search reaches into what we sent",
    (await listThreads({ ...ALL, query: "not before" })).map((one) => one.threadKey),
    [KEY],
  );
  check(
    "search is case-insensitive",
    (await listThreads({ ...ALL, query: "COMPILERS" })).length,
    1,
  );
  check(
    "a wildcard is a character, not a pattern",
    (await listThreads({ ...ALL, query: "%" })).length,
    0,
  );
  check("an underscore too", (await listThreads({ ...ALL, query: "_" })).length, 0);
  check("no match is no rows", (await listThreads({ ...ALL, query: "nothing here" })).length, 0);

  // ---- workspaces ----
  //
  // The address a message arrives at decides which business it belongs to, and
  // an operator scoped to the other one must not be able to see it — by list,
  // by count, or by pasting its thread key into the URL.

  await recordInbound(
    message({
      resendId: "a1",
      threadKey: ACADEMY,
      fromEmail: "parent@example.test",
      fromName: "A Parent",
      toEmail: "orders@byteveda.org",
      subject: "The worksheet",
      text: "Can we get the answer key too?",
    }),
    new Date("2026-09-06T10:00:00Z"),
  );

  const [academy] = await listThreads({ ...ALL, workspace: "academy" });
  check("mail to orders@ is the academy's", academy?.threadKey, ACADEMY);
  check(
    "and is not in the ByteVeda tab",
    (await listThreads({ ...ALL, workspace: "byteveda" }))
      .map((one) => one.threadKey)
      .includes(ACADEMY),
    false,
  );

  check(
    "an operator without the academy cannot list it",
    (await listThreads(ONLY_BYTEVEDA)).map((one) => one.threadKey).includes(ACADEMY),
    false,
  );
  check("nor open it by its key", await getConversation(ACADEMY, ONLY_BYTEVEDA), null);
  check(
    "nor is it in their counts",
    (await countThreads(ONLY_BYTEVEDA)).inbox,
    (await listThreads(ONLY_BYTEVEDA)).length,
  );
  check("nor in their badge", await countUnread({ allowed: [] }), 0);

  console.log(failures === 0 ? "\nPASS" : `\nFAIL: ${failures} check(s)`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
