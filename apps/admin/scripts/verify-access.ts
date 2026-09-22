/**
 * Exercises access control and attachment storage against a real Postgres.
 *
 * The companion to `verify-inbox.ts`, and for the same reason: everything
 * checked here is a statement the database decides. Whether a suspended member
 * is refused, whether an invite that was never accepted still counts, and
 * whether a file survives a round trip through a `bytea` column are all things
 * a unit test can only pretend to know.
 *
 * Destructive. Point it at a throwaway:
 *
 *   docker run -d --name bv -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=app \
 *     -p 55434:5432 postgres:16-alpine
 *   for f in packages/db/migrations/0*.sql; do psql … -f "$f"; done
 *   DATABASE_URL=postgresql://postgres:pw@localhost:55434/app DATABASE_SSL=disable \
 *     node --import tsx scripts/verify-access.ts
 */
import { randomBytes } from "node:crypto";
import {
  adminUsers,
  closeDb,
  emailAttachments,
  emailThreads,
  getDb,
  outboundMessages,
  sessions,
} from "@byteveda/db";
import { eq } from "drizzle-orm";
import * as attachments from "../src/features/attachments";
import { accessFor, can, canReadWorkspace, readableWorkspaces } from "../src/features/auth/model";
import { listMembers } from "../src/features/members/queries";
import { admit } from "../src/features/members/service";

let failures = 0;

function check(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "pass" : "FAIL"}  ${what}${ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`,
  );
}

const INVITED = 900001;
const STRANGER = 900002;

function profile(id: number, login: string) {
  return { id, login, name: null, email: null, avatarUrl: null };
}

async function main() {
  const db = getDb();
  await db.delete(emailAttachments);
  await db.delete(outboundMessages);
  await db.delete(emailThreads);
  await db.delete(sessions);
  await db.delete(adminUsers);

  // ---- who gets in ----

  check("a stranger is refused", await admit(profile(STRANGER, "stranger")), {
    ok: false,
    reason: "denied",
  });

  // The invite is a row, written before they have ever signed in.
  const [invited] = await db
    .insert(adminUsers)
    .values({
      githubId: INVITED,
      login: "invited",
      role: "support",
      mailWorkspaces: ["academy"],
    })
    .returning();

  check("an invitation that was never accepted has no last login", invited.lastLoginAt, null);

  const first = await admit(profile(INVITED, "invited-renamed"));
  check("an invited account is admitted", first.ok, true);
  check("and its login is refreshed from GitHub", first.ok && first.user.login, "invited-renamed");
  check("and the grant is not overwritten by signing in", first.ok && first.user.role, "support");
  check("nor is its mail scope", first.ok && first.user.mailWorkspaces, ["academy"]);

  const signedInAt = first.ok ? first.user.lastLoginAt : null;
  check("signing in is recorded", signedInAt !== null, true);

  // ---- suspension ----

  await db.update(adminUsers).set({ status: "suspended" }).where(eq(adminUsers.githubId, INVITED));

  check("a suspended member is refused", await admit(profile(INVITED, "invited")), {
    ok: false,
    reason: "suspended",
  });

  const [afterRefusal] = await db.select().from(adminUsers).where(eq(adminUsers.githubId, INVITED));

  check(
    "and a refused sign-in does not look like a visit",
    afterRefusal.lastLoginAt?.toISOString(),
    signedInAt?.toISOString(),
  );

  await db.update(adminUsers).set({ status: "active" }).where(eq(adminUsers.githubId, INVITED));

  // ---- what the row resolves to ----

  const support = accessFor(afterRefusal, false);
  check("support can answer mail", can(support, "mail.send"), true);
  check("but only in the workspace it was given", canReadWorkspace(support, "academy"), true);
  check("and not the other one", canReadWorkspace(support, "byteveda"), false);
  check("and never members", can(support, "members.manage"), false);
  check("its readable set is what the tabs show", readableWorkspaces(support), ["academy"]);

  const superAdmin = accessFor(afterRefusal, true);
  check("a super admin ignores the row entirely", readableWorkspaces(superAdmin), [
    "byteveda",
    "academy",
  ]);
  check("and can manage members", can(superAdmin, "members.manage"), true);

  const listed = await listMembers();
  check("the members page sees one member", listed.length, 1);
  check("with no session open", listed[0]?.activeSessions, 0);

  // ---- attachments ----

  const scope = { kind: "reply", id: "ada@example.test::about the queue" } as const;

  // Not text: the point of a `bytea` column is that arbitrary bytes come back
  // exactly as they went in, and a PDF is full of bytes no encoding survives.
  const bytes = randomBytes(64 * 1024);

  const staged = await attachments.stage({
    scope,
    filename: "../../etc/passwd",
    contentType: "application/pdf",
    content: bytes,
    uploadedBy: afterRefusal.id,
  });

  check("the filename is not a path", staged.filename, "passwd");
  check("the size is the file's own", staged.byteSize, bytes.byteLength);

  const [loaded] = await attachments.loadForSend(scope);
  check("the bytes survive the round trip", loaded.content.equals(bytes), true);

  check("it is staged in its composer", (await attachments.listStaged(scope)).length, 1);
  check(
    "and in no other",
    (await attachments.listStaged({ kind: "reply", id: "somebody@else.test::hello" })).length,
    0,
  );

  // ---- sending claims it ----

  await db.insert(emailThreads).values({
    threadKey: scope.id,
    subject: "About the queue",
    correspondentEmail: "ada@example.test",
    mailbox: "hello@byteveda.org",
  });

  const [message] = await db
    .insert(outboundMessages)
    .values({
      threadKey: scope.id,
      toEmail: "ada@example.test",
      fromEmail: "hello@byteveda.org",
      subject: "Re: About the queue",
      kind: "reply",
      bodyText: "Here it is.",
    })
    .returning({ id: outboundMessages.id });

  check("sending claims what was staged", await attachments.claim(scope, message.id), 1);
  check("so the composer is empty again", (await attachments.listStaged(scope)).length, 0);
  check(
    "and a sent file cannot be discarded as a draft",
    await attachments.discard(scope, staged.id),
    false,
  );

  const described = await attachments.describe(staged.id);
  check("but it is still there, on its message", described?.messageId, message.id);

  // ---- housekeeping ----

  const abandoned = await attachments.stage({
    scope: { kind: "broadcast", id: "00000000-0000-0000-0000-000000000000" },
    filename: "draft.pdf",
    contentType: "application/pdf",
    content: Buffer.from("never sent"),
    uploadedBy: afterRefusal.id,
  });

  check("a fresh upload is not swept", await attachments.pruneStale(), 0);

  // Eight days old: past the week an unsent upload is kept for.
  await db
    .update(emailAttachments)
    .set({ createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
    .where(eq(emailAttachments.id, abandoned.id));

  check("an abandoned one is", await attachments.pruneStale(), 1);
  check("and what was sent is left alone", (await attachments.describe(staged.id)) !== null, true);

  // ---- deleting the message takes its files ----

  await db.delete(outboundMessages).where(eq(outboundMessages.id, message.id));
  check("a deleted message takes its attachments", await attachments.describe(staged.id), null);

  console.log(failures === 0 ? "\nPASS" : `\nFAIL: ${failures} check(s)`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
