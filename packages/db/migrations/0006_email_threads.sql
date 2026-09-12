-- A conversation becomes a row, and both directions hang off it.
--
-- Hand-ordered rather than left as drizzle-kit emitted it: the foreign keys
-- cannot go on until every thread exists, and the thread rows are built out of
-- the two columns dropped at the end.

CREATE TABLE "email_threads" (
	"thread_key" text PRIMARY KEY NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"correspondent_email" text NOT NULL,
	"correspondent_name" text,
	"mailbox" text DEFAULT '' NOT NULL,
	"preview" text DEFAULT '' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD COLUMN "from_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD COLUMN "thread_key" text;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD COLUMN "body_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD COLUMN "body_html" text;--> statement-breakpoint

-- One thread per conversation already in the inbox. The latest message decides
-- the correspondent and the mailbox, which is what the list query was
-- re-deriving with `array_agg` on every render.
--
-- The subject comes from the *first* message instead, and skips the empty ones.
-- A conversation is about what it was opened about; taking the latest subject
-- means every answered thread is titled "Re: ...", which is the reply's subject
-- rather than the conversation's.
--
-- A thread counts as read only when every message in it was: a thread with one
-- unread message is unread, and `read_at` left null is what says so.
--
-- `last_outbound_at` comes from `replied_at` rather than from the send log,
-- because it has to be right even for the replies the pass below cannot match.
INSERT INTO "email_threads" (
	"thread_key", "subject", "correspondent_email", "correspondent_name",
	"mailbox", "preview", "last_message_at", "last_inbound_at", "last_outbound_at",
	"read_at", "created_at"
)
SELECT
	"thread_key",
	coalesce((array_agg("subject" ORDER BY "received_at") FILTER (WHERE "subject" <> ''))[1], ''),
	(array_agg("from_email" ORDER BY "received_at" DESC))[1],
	(array_agg("from_name" ORDER BY "received_at" DESC) FILTER (WHERE "from_name" IS NOT NULL))[1],
	(array_agg("to_email" ORDER BY "received_at" DESC))[1],
	left(btrim(regexp_replace(
		(array_agg("text" ORDER BY "received_at" DESC))[1], '[[:space:]]+', ' ', 'g'
	)), 200),
	greatest(max("received_at"), coalesce(max("replied_at"), max("received_at"))),
	max("received_at"),
	max("replied_at"),
	CASE WHEN count(*) FILTER (WHERE "read_at" IS NULL) = 0 THEN max("read_at") END,
	min("received_at")
FROM "inbound_messages"
GROUP BY "thread_key";
--> statement-breakpoint

-- Replies already sent, matched back onto the thread they answered.
--
-- Their bodies were never stored and cannot be recovered — the console sent the
-- text to Resend and kept only the subject. Linking them is still worth it: the
-- conversation then shows that it was answered, and when, rather than ending on
-- the correspondent's last message as though nobody ever wrote back.
--
-- This is the same normalisation as `lib/email/thread.ts`, in SQL, with one
-- difference: it strips a single reply prefix rather than looping. Our own
-- template adds exactly one.
WITH normalised AS (
	SELECT
		"id",
		lower(btrim("to_email")) AS correspondent,
		btrim(regexp_replace(
			regexp_replace(
				lower(btrim(left("subject", 512))),
				'^(re|fw|fwd|aw|sv|vs|antw)[[:space:]]*(\[[0-9]{1,3}\])?[[:space:]]*:[[:space:]]*',
				''
			),
			'[[:space:]]+', ' ', 'g'
		)) AS subject_key
	FROM "outbound_messages"
	WHERE "kind" = 'reply' AND "thread_key" IS NULL
)
UPDATE "outbound_messages" o
SET "thread_key" = t."thread_key", "from_email" = t."mailbox"
FROM normalised n
JOIN "email_threads" t
	ON t."thread_key" = n.correspondent || '::' || coalesce(nullif(n.subject_key, ''), '(no subject)')
WHERE o."id" = n."id";
--> statement-breakpoint

-- Second pass for the replies whose subject was edited on the way out: if that
-- correspondent only ever had one conversation, there is no ambiguity about
-- which one it belongs to.
UPDATE "outbound_messages" o
SET "thread_key" = t."thread_key", "from_email" = t."mailbox"
FROM "email_threads" t
WHERE o."kind" = 'reply'
	AND o."thread_key" IS NULL
	AND t."correspondent_email" = lower(btrim(o."to_email"))
	AND (
		SELECT count(*) FROM "email_threads" t2
		WHERE t2."correspondent_email" = lower(btrim(o."to_email"))
	) = 1;
--> statement-breakpoint

-- A send that was logged but never got a `replied_at` — a failed one, or one
-- sent before that column was written — still moved the conversation.
UPDATE "email_threads" t
SET
	"last_outbound_at" = greatest(t."last_outbound_at", s."last_sent"),
	"last_message_at" = greatest(t."last_message_at", s."last_sent")
FROM (
	SELECT "thread_key", max("sent_at") AS "last_sent"
	FROM "outbound_messages"
	WHERE "thread_key" IS NOT NULL
	GROUP BY "thread_key"
) s
WHERE s."thread_key" = t."thread_key";
--> statement-breakpoint

ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_thread_key_email_threads_thread_key_fk" FOREIGN KEY ("thread_key") REFERENCES "public"."email_threads"("thread_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_thread_key_email_threads_thread_key_fk" FOREIGN KEY ("thread_key") REFERENCES "public"."email_threads"("thread_key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_threads_active_idx" ON "email_threads" USING btree ("last_message_at") WHERE "archived_at" is null;--> statement-breakpoint
CREATE INDEX "email_threads_archived_idx" ON "email_threads" USING btree ("last_message_at") WHERE "archived_at" is not null;--> statement-breakpoint
CREATE INDEX "outbound_messages_thread_idx" ON "outbound_messages" USING btree ("thread_key","sent_at") WHERE "thread_key" is not null;--> statement-breakpoint
ALTER TABLE "inbound_messages" DROP COLUMN "read_at";--> statement-breakpoint
ALTER TABLE "inbound_messages" DROP COLUMN "replied_at";
