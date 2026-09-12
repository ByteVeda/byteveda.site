import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  BROADCAST_STATUSES,
  type BroadcastStatus,
  OUTBOUND_KINDS,
  type OutboundKind,
  SUBSCRIBER_STATUSES,
  type SubscriberStatus,
} from "../constants";
import { posts } from "./posts";

export type { BroadcastStatus, OutboundKind, SubscriberStatus };
export { BROADCAST_STATUSES, OUTBOUND_KINDS, SUBSCRIBER_STATUSES };

function oneOf(column: string, values: readonly string[]) {
  return sql.raw(`"${column}" in (${values.map((value) => `'${value}'`).join(", ")})`);
}

/**
 * The mailing list.
 *
 * Double opt-in: a signup lands as `pending` and only becomes `active` when the
 * confirmation link is followed. `token` serves both that link and the
 * unsubscribe link, so neither needs the address in the URL.
 */
export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored lowercased; the constraint below is what keeps it that way. */
    email: text("email").notNull(),
    status: text("status").$type<SubscriberStatus>().notNull().default("pending"),
    token: text("token").notNull(),
    /** Where the signup came from — a site slug, or "admin". */
    source: text("source").notNull().default("unknown"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("subscribers_email_idx").on(table.email),
    uniqueIndex("subscribers_token_idx").on(table.token),
    index("subscribers_status_idx").on(table.status),
    check("subscribers_status_check", oneOf("status", SUBSCRIBER_STATUSES)),
    // Case-folding at the boundary would still let a second row in through any
    // other client; the database is where "one address, one row" is decided.
    check("subscribers_email_lowercase_check", sql`"email" = lower("email")`),
    check("subscribers_email_shape_check", sql`"email" ~ '^[^@[:space:]]+@[^@[:space:]]+$'`),
  ],
);

/** A message sent to the whole active list. */
export const broadcasts = pgTable(
  "broadcasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: text("subject").notNull(),
    bodyMarkdown: text("body_markdown").notNull().default(""),
    status: text("status").$type<BroadcastStatus>().notNull().default("draft"),
    /** Set when the broadcast announces a post. */
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("broadcasts_status_idx").on(table.status),
    check("broadcasts_status_check", oneOf("status", BROADCAST_STATUSES)),
    // A post is announced once; the partial index lets every non-announcement
    // broadcast keep a null post_id.
    uniqueIndex("broadcasts_post_idx").on(table.postId).where(sql`"post_id" is not null`),
  ],
);

/**
 * A conversation with one correspondent.
 *
 * Exists because thread state is not a property of any message in the thread.
 * Read, archived, who it is with, what it is about, when it last moved — each
 * one was previously re-derived from the inbound rows with an `array_agg` on
 * every render, and "archived" had nowhere to live at all. Worse, "when it last
 * moved" could only ever mean the last message *received*, so answering a
 * conversation did not bring it to the top of the inbox.
 *
 * Read is a timestamp rather than a flag: unread is `last_inbound_at` being
 * newer than `read_at`, which makes a reply arriving in an open-and-read thread
 * mark it unread again without anything having to remember to.
 */
export const emailThreads = pgTable(
  "email_threads",
  {
    /** The correspondent plus the normalised subject. See `lib/email/thread.ts`. */
    threadKey: text("thread_key").primaryKey(),
    /** As last written, not normalised — this is the line the operator reads. */
    subject: text("subject").notNull().default(""),
    correspondentEmail: text("correspondent_email").notNull(),
    correspondentName: text("correspondent_name"),
    /** The address they wrote to, which is the one a reply leaves from. */
    mailbox: text("mailbox").notNull().default(""),
    /**
     * The opening of the last message, whoever sent it.
     *
     * Denormalised so the list is one index scan rather than a lateral join
     * into two message tables for every row. `touchThread` is the only writer,
     * which is what keeps it honest.
     */
    preview: text("preview").notNull().default(""),
    /** Either direction. What the inbox sorts on. */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    /** Their side only. Unread is this being newer than `read_at`. */
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    /** Our side only. Set means answered; newer than the inbound means we spoke last. */
    lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The inbox is "unarchived, newest first", and nothing else is a hot path.
    index("email_threads_active_idx").on(table.lastMessageAt).where(sql`"archived_at" is null`),
    index("email_threads_archived_idx")
      .on(table.lastMessageAt)
      .where(sql`"archived_at" is not null`),
  ],
);

/**
 * Every message sent, whatever sent it.
 *
 * Kept so a bounce, a duplicate, or "did that actually go out?" has an answer
 * that does not depend on logging into Resend.
 *
 * A reply carries `thread_key` and its own body, which is what makes it part of
 * a conversation rather than only a line in a send log. Without those the
 * console sent the mail, recorded that it had, and then showed the operator a
 * thread with their answer missing from it.
 */
export const outboundMessages = pgTable(
  "outbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Resend's id, absent when the send failed before it got one. */
    resendId: text("resend_id"),
    toEmail: text("to_email").notNull(),
    /** Which mailbox it left from. Per-thread for a reply, not per-console. */
    fromEmail: text("from_email").notNull().default(""),
    subject: text("subject").notNull(),
    kind: text("kind").$type<OutboundKind>().notNull(),
    /**
     * Set for a reply, null for a broadcast or a confirmation. `set null` on a
     * deleted conversation rather than `cascade`: the thread goes, the record
     * that something was sent to that address stays.
     */
    threadKey: text("thread_key").references(() => emailThreads.threadKey, {
      onDelete: "set null",
    }),
    /** What was written, so the thread can show it. Empty for a bulk send. */
    bodyText: text("body_text").notNull().default(""),
    bodyHtml: text("body_html"),
    broadcastId: uuid("broadcast_id").references(() => broadcasts.id, { onDelete: "cascade" }),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("outbound_messages_sent_idx").on(table.sentAt),
    index("outbound_messages_broadcast_idx").on(table.broadcastId),
    index("outbound_messages_thread_idx")
      .on(table.threadKey, table.sentAt)
      .where(sql`"thread_key" is not null`),
    check("outbound_messages_kind_check", oneOf("kind", OUTBOUND_KINDS)),
  ],
);

/**
 * Mail arriving through Resend's inbound webhook.
 *
 * `resend_id` is unique because a webhook is delivered at least once — the
 * constraint is what makes a redelivery a no-op rather than a duplicate.
 *
 * Carries no read or replied state of its own. Both were properties of the
 * conversation wearing a message's clothes, and both now live on `email_threads`
 * — where "archived" can join them and where answering can move a thread.
 */
export const inboundMessages = pgTable(
  "inbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resendId: text("resend_id").notNull(),
    /** Groups a conversation: the correspondent plus the normalised subject. */
    threadKey: text("thread_key")
      .notNull()
      .references(() => emailThreads.threadKey, { onDelete: "cascade" }),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull().default(""),
    text: text("text").notNull().default(""),
    html: text("html"),
    headers: jsonb("headers").$type<Record<string, string>>(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("inbound_messages_resend_idx").on(table.resendId),
    index("inbound_messages_thread_idx").on(table.threadKey, table.receivedAt),
    index("inbound_messages_received_idx").on(table.receivedAt),
  ],
);

export const broadcastsRelations = relations(broadcasts, ({ many, one }) => ({
  messages: many(outboundMessages),
  post: one(posts, { fields: [broadcasts.postId], references: [posts.id] }),
}));

export const emailThreadsRelations = relations(emailThreads, ({ many }) => ({
  received: many(inboundMessages),
  sent: many(outboundMessages),
}));

export type Subscriber = typeof subscribers.$inferSelect;
export type Broadcast = typeof broadcasts.$inferSelect;
export type EmailThread = typeof emailThreads.$inferSelect;
export type InboundMessage = typeof inboundMessages.$inferSelect;
export type OutboundMessage = typeof outboundMessages.$inferSelect;
