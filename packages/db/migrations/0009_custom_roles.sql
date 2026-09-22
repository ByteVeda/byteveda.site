CREATE TYPE "public"."admin_permission" AS ENUM('posts.read', 'posts.write', 'posts.publish', 'stats.read', 'stats.write', 'subscribers.read', 'subscribers.write', 'broadcasts.send', 'mail.read', 'mail.send', 'mail.manage', 'settings.read', 'settings.write', 'members.read', 'members.manage');--> statement-breakpoint
CREATE TABLE "admin_custom_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"permissions" "admin_permission"[] DEFAULT '{}' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_custom_roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "custom_role_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "extra_permissions" "admin_permission"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "denied_permissions" "admin_permission"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_custom_role_id_admin_custom_roles_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."admin_custom_roles"("id") ON DELETE set null ON UPDATE no action;