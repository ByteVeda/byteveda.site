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
 * Every message sent, whatever sent it.
 *
 * Kept so a bounce, a duplicate, or "did that actually go out?" has an answer
 * that does not depend on logging into Resend.
 */
export const outboundMessages = pgTable(
  "outbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Resend's id, absent when the send failed before it got one. */
    resendId: text("resend_id"),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    kind: text("kind").$type<OutboundKind>().notNull(),
    broadcastId: uuid("broadcast_id").references(() => broadcasts.id, { onDelete: "cascade" }),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("outbound_messages_sent_idx").on(table.sentAt),
    index("outbound_messages_broadcast_idx").on(table.broadcastId),
    check("outbound_messages_kind_check", oneOf("kind", OUTBOUND_KINDS)),
  ],
);

/**
 * Mail arriving through Resend's inbound webhook.
 *
 * `resend_id` is unique because a webhook is delivered at least once — the
 * constraint is what makes a redelivery a no-op rather than a duplicate.
 */
export const inboundMessages = pgTable(
  "inbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resendId: text("resend_id").notNull(),
    /** Groups a conversation: the correspondent plus the normalised subject. */
    threadKey: text("thread_key").notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull().default(""),
    text: text("text").notNull().default(""),
    html: text("html"),
    headers: jsonb("headers").$type<Record<string, string>>(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
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

export type Subscriber = typeof subscribers.$inferSelect;
export type Broadcast = typeof broadcasts.$inferSelect;
export type InboundMessage = typeof inboundMessages.$inferSelect;
export type OutboundMessage = typeof outboundMessages.$inferSelect;
