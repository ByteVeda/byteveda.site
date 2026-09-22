CREATE TYPE "public"."admin_role" AS ENUM('admin', 'editor', 'support', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."admin_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."mail_workspace" AS ENUM('byteveda', 'academy');--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"message_id" uuid,
	"filename" text NOT NULL,
	"content_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"byte_size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "email_threads_active_idx";--> statement-breakpoint
DROP INDEX "email_threads_archived_idx";--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "role" "admin_role" DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "status" "admin_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "mail_workspaces" "mail_workspace"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "workspace" "mail_workspace" DEFAULT 'byteveda' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_outbound_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."outbound_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_uploaded_by_admin_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_attachments_scope_idx" ON "email_attachments" USING btree ("scope","created_at") WHERE "message_id" is null;--> statement-breakpoint
CREATE INDEX "email_attachments_message_idx" ON "email_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "email_threads_active_idx" ON "email_threads" USING btree ("workspace","last_message_at") WHERE "archived_at" is null;--> statement-breakpoint
CREATE INDEX "email_threads_archived_idx" ON "email_threads" USING btree ("workspace","last_message_at") WHERE "archived_at" is not null;--> statement-breakpoint
-- Everyone already in this table got in through ADMIN_GITHUB_IDS, which was an
-- unconditional grant. The column default is 'viewer', so without this the
-- migration would quietly demote the people who deployed it.
UPDATE "admin_users" SET "role" = 'admin', "mail_workspaces" = '{byteveda,academy}';--> statement-breakpoint
-- Backfills the workspace for conversations that arrived before the column
-- existed. Mirrors `workspaceOf` in apps/admin/src/lib/mail/workspaces.ts,
-- including its second signal: the academy writes to itself, so a work order
-- from academy@ is the academy's whichever inbox it landed in. The column
-- default covers everything this does not match.
UPDATE "email_threads" SET "workspace" = 'academy'
WHERE split_part(lower("mailbox"), '@', 1) IN ('academy', 'orders', 'samples', 'admissions')
   OR split_part(lower("mailbox"), '@', 2) LIKE 'academy.%'
   OR split_part(lower("correspondent_email"), '@', 1) IN ('academy', 'orders', 'samples', 'admissions')
   OR split_part(lower("correspondent_email"), '@', 2) LIKE 'academy.%';