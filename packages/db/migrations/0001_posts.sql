CREATE TABLE "post_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"body_mdx" text DEFAULT '' NOT NULL,
	"body_format" text DEFAULT 'richtext' NOT NULL,
	"editor_json" jsonb,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site" text DEFAULT 'flexiq' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"body_mdx" text DEFAULT '' NOT NULL,
	"body_format" text DEFAULT 'richtext' NOT NULL,
	"editor_json" jsonb,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"seo" jsonb DEFAULT '{"keywords":[]}'::jsonb NOT NULL,
	"author" text DEFAULT 'ByteVeda' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_site_check" CHECK ("site" in ('flexiq')),
	CONSTRAINT "posts_status_check" CHECK ("status" in ('draft', 'published', 'archived')),
	CONSTRAINT "posts_body_format_check" CHECK ("body_format" in ('richtext', 'mdx')),
	CONSTRAINT "posts_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "posts_published_at_check" CHECK (("status" = 'published') = ("published_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_author_id_admin_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_revisions_post_id_created_idx" ON "post_revisions" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_site_slug_idx" ON "posts" USING btree ("site","slug");--> statement-breakpoint
CREATE INDEX "posts_site_status_published_idx" ON "posts" USING btree ("site","status","published_at");