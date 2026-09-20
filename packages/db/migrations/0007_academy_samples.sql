CREATE SCHEMA "academy";
--> statement-breakpoint
CREATE TYPE "academy"."sample_kind" AS ENUM('chapter', 'custom');--> statement-breakpoint
CREATE TABLE "academy"."sample_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"reference" text NOT NULL,
	"kind" "academy"."sample_kind" NOT NULL,
	"chapter_id" text,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"request" jsonb,
	"list_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sample_requests_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "sample_requests_created_idx" ON "academy"."sample_requests" USING btree ("created_at");