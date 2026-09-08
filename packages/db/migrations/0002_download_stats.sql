CREATE TABLE "collection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" text NOT NULL,
	"detail" text,
	"days_written" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"day" date NOT NULL,
	"downloads" bigint NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "download_snapshots_downloads_check" CHECK ("downloads" >= 0)
);
--> statement-breakpoint
CREATE TABLE "package_totals" (
	"package_id" uuid PRIMARY KEY NOT NULL,
	"total" bigint NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_slug" text NOT NULL,
	"ecosystem" text NOT NULL,
	"package_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_packages_ecosystem_check" CHECK ("ecosystem" in ('pypi', 'npm', 'crates', 'maven'))
);
--> statement-breakpoint
ALTER TABLE "collection_runs" ADD CONSTRAINT "collection_runs_package_id_project_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_snapshots" ADD CONSTRAINT "download_snapshots_package_id_project_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_totals" ADD CONSTRAINT "package_totals_package_id_project_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_runs_started_idx" ON "collection_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "download_snapshots_package_day_idx" ON "download_snapshots" USING btree ("package_id","day");--> statement-breakpoint
CREATE INDEX "download_snapshots_day_idx" ON "download_snapshots" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "project_packages_ecosystem_name_idx" ON "project_packages" USING btree ("ecosystem","package_name");--> statement-breakpoint
CREATE INDEX "project_packages_project_idx" ON "project_packages" USING btree ("project_slug");