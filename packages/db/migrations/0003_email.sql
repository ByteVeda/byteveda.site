CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body_markdown" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"post_id" uuid,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broadcasts_status_check" CHECK ("status" in ('draft', 'sending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resend_id" text NOT NULL,
	"thread_key" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_email" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"html" text,
	"headers" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"replied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "outbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resend_id" text,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"kind" text NOT NULL,
	"broadcast_id" uuid,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbound_messages_kind_check" CHECK ("kind" in ('transactional', 'confirmation', 'broadcast', 'announcement', 'reply'))
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"source" text DEFAULT 'unknown' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_status_check" CHECK ("status" in ('pending', 'active', 'unsubscribed', 'bounced')),
	CONSTRAINT "subscribers_email_lowercase_check" CHECK ("email" = lower("email")),
	CONSTRAINT "subscribers_email_shape_check" CHECK ("email" ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broadcasts_status_idx" ON "broadcasts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "broadcasts_post_idx" ON "broadcasts" USING btree ("post_id") WHERE "post_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_messages_resend_idx" ON "inbound_messages" USING btree ("resend_id");--> statement-breakpoint
CREATE INDEX "inbound_messages_thread_idx" ON "inbound_messages" USING btree ("thread_key","received_at");--> statement-breakpoint
CREATE INDEX "inbound_messages_received_idx" ON "inbound_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "outbound_messages_sent_idx" ON "outbound_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "outbound_messages_broadcast_idx" ON "outbound_messages" USING btree ("broadcast_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_token_idx" ON "subscribers" USING btree ("token");--> statement-breakpoint
CREATE INDEX "subscribers_status_idx" ON "subscribers" USING btree ("status");